const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const SalaryRecord = require('../models/SalaryRecord');
const SalaryAdvance = require('../models/SalaryAdvance');
const Expense = require('../models/Expense');
const ExpenseCategory = require('../models/ExpenseCategory');
const { withTransaction, sessionOpts } = require('../utils/transaction');
const { assertMonthsOpen, MonthClosedError } = require('../utils/monthLock');
const {
  MONTH_NAMES, monthKeyFromName, partsOf, formatMonthKey, currentMonthKey, OFFSET_MINUTES,
} = require('../utils/ledgerMonth');

/**
 * The monthly salary sheet, its payments, and staff advances.
 *
 * Staff are never duplicated here — every row references an `Employee` by id and
 * reads its pay from that record. The sheet is a view over the staff list plus
 * whatever has already been posted for the month, so adding a member of staff
 * makes them appear on the next sheet without anything being copied.
 *
 * MONEY, ONCE
 * An advance is cash leaving on the day it is handed over, so it posts its own
 * expense then. Recovering it later is a deduction on the sheet, not a second
 * expense — the salary posts only what it actually pays out. Booking both would
 * count the same rupee twice, which is why recovery and payment happen inside one
 * transaction and never separately.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const roundUp10 = (n) => (n <= 0 ? 0 : Math.ceil((Number(n) || 0) / 10) * 10);

const getWorkingDaysInMonth = (year, month) => 30;

/** The Salaries category for a campus, used to file salary payments in the ledger. */
const salaryCategoryFor = async (campusId, session = null) => {
  const q = ExpenseCategory.findOne({ campus: campusId, legacyKey: 'Salary', isDeleted: false }).select('_id');
  if (session) q.session(session);
  return q.lean();
};

/** '2026-08' → { salaryMonth: 'August', salaryYear: 2026 } for the existing schema fields. */
const monthFields = (monthKey) => {
  const parts = partsOf(monthKey);
  if (!parts) return null;
  return { salaryMonth: MONTH_NAMES[parts.month - 1], salaryYear: parts.year };
};

/** Payday: the 28th at 17:00 Karachi, so the row lands squarely inside its month. */
const defaultPayDate = (monthKey) => {
  const parts = partsOf(monthKey);
  if (!parts) return new Date();
  return new Date(Date.UTC(parts.year, parts.month - 1, 28, 17, 0, 0) - OFFSET_MINUTES * 60 * 1000);
};

// @desc    The salary sheet for a month: every active employee, posted or proposed
// @route   GET /api/salaries/sheet?month=2026-08
const getSalarySheet = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus) return res.status(400).json({ message: 'An active campus is required' });

    const monthKey = req.query.month || currentMonthKey();
    const mf = monthFields(monthKey);
    if (!mf) return res.status(400).json({ message: 'Month must look like 2026-08' });

    const parts = partsOf(monthKey);
    const startOfMonth = new Date(Date.UTC(parts.year, parts.month - 1, 1, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(parts.year, parts.month, 0, 23, 59, 59, 999));

    // 1. Fetch this month's posted records and open advances
    const [posted, advances] = await Promise.all([
      SalaryRecord.find({ campus: currentCampus, ...mf, isDeleted: false }).lean(),
      SalaryAdvance.find({
        campus: currentCampus, status: 'Outstanding', isDeleted: false,
      }).lean(),
    ]);

    const postedEmpIds = posted.map((p) => p.employee);
    const postedBy = new Map(posted.map((p) => [String(p.employee), p]));

    // 2. Fetch employees:
    // - Include ANY employee who has a posted salary record for this month (even if now Resigned/Left/Deleted)
    // - Plus any staff at this campus
    const employees = await Employee.find({
      campus: currentCampus,
      $or: [
        { _id: { $in: postedEmpIds } },
        { isDeleted: false },
      ],
    })
      .select('employeeId fullName designation department salary allowances deductions status joiningDate leavingDate updatedAt isDeleted')
      .sort({ fullName: 1 })
      .lean();

    const advancesBy = new Map();
    for (const a of advances) {
      if (monthKey < a.recoverFromMonth) continue;
      const left = Math.max(0, (a.amount || 0) - (a.amountRecovered || 0));
      if (left <= 0) continue;
      const due = a.monthlyInstalment > 0 ? Math.min(a.monthlyInstalment, left) : left;
      const list = advancesBy.get(String(a.employee)) || [];
      list.push({ advance: a._id, amount: round2(due), total: a.amount, outstanding: left });
      advancesBy.set(String(a.employee), list);
    }

    const processedEmpIds = new Set();
    const rows = [];

    // Filter and build rows for employees
    for (const emp of employees) {
      const empIdStr = String(emp._id);
      const record = postedBy.get(empIdStr);

      // Rule: If a salary was already posted, ALWAYS include it on this month's sheet.
      // A posted salary is an official historical financial transaction that must never be hidden or omitted.
      if (record) {
        processedEmpIds.add(empIdStr);
        const doc = SalaryRecord.hydrate(record);
        const pendingAdvances = advancesBy.get(empIdStr) || [];
        rows.push({
          employee: {
            _id: emp._id,
            employeeId: emp.employeeId,
            fullName: emp.fullName,
            designation: emp.designation,
            department: emp.department,
            status: emp.status,
            leavingDate: emp.leavingDate,
          },
          salaryRecord: record._id,
          posted: true,
          baseSalary: record.baseSalary,
          allowances: record.allowances || 0,
          advanceDeduction: record.advanceDeduction || 0,
          absenceDeduction: record.absenceDeduction || 0,
          taxDeduction: record.taxDeduction || 0,
          securityDeposit: record.securityDeposit || 0,
          otherDeduction: record.otherDeduction || 0,
          absentDays: record.absentDays || 0,
          attendanceBonus: record.attendanceBonus || 0,
          deductions: record.deductions || 0,
          netSalary: record.netSalary,
          amountPaid: doc.paidAmount(),
          outstanding: doc.outstandingAmount(),
          status: record.status,
          paymentDate: record.paymentDate,
          paymentMethod: record.paymentMethod,
          remarks: record.remarks || '',
          pendingAdvances,
        });
        continue;
      }

      // If not posted, determine whether this employee was employed during this month:
      if (emp.isDeleted) continue;

      // 1. Check joining date: if they joined AFTER this month ended, they don't belong here yet
      if (emp.joiningDate && new Date(emp.joiningDate) > endOfMonth) {
        continue;
      }

      // 2. Check leaving status and date:
      if (emp.status && emp.status !== 'Active') {
        if (emp.leavingDate) {
          // If they left BEFORE this month started, they are no longer employed this month
          if (new Date(emp.leavingDate) < startOfMonth) {
            continue;
          }
        } else if (emp.updatedAt && new Date(emp.updatedAt) < startOfMonth) {
          // Fallback if no leavingDate was set: if updated before this month, skip
          continue;
        }
      }

      // Employee was active during this month -> build proposal
      processedEmpIds.add(empIdStr);
      const pendingAdvances = advancesBy.get(empIdStr) || [];
      const advanceDue = round2(pendingAdvances.reduce((s, a) => s + a.amount, 0));

      const base = emp.salary || 0;
      const allowances = emp.allowances || 0;
      const standing = emp.deductions || 0;

      let proposedAbsenceDeduction = 0;
      let proposedAttendanceBonus = 0;

      const deductions = round2(standing + advanceDue + proposedAbsenceDeduction);
      const net = round2(base + allowances + proposedAttendanceBonus - deductions);

      rows.push({
        employee: {
          _id: emp._id,
          employeeId: emp.employeeId,
          fullName: emp.fullName,
          designation: emp.designation,
          department: emp.department,
          status: emp.status,
          leavingDate: emp.leavingDate,
        },
        salaryRecord: null,
        posted: false,
        baseSalary: base,
        allowances,
        advanceDeduction: advanceDue,
        absenceDeduction: proposedAbsenceDeduction,
        taxDeduction: 0,
        securityDeposit: 0,
        otherDeduction: standing,
        absentDays: 0,
        attendanceBonus: proposedAttendanceBonus,
        deductions,
        netSalary: net,
        amountPaid: 0,
        outstanding: net,
        status: 'Pending',
        paymentDate: null,
        paymentMethod: null,
        remarks: '',
        pendingAdvances,
      });
    }

    // Safety net: in case a posted salary record exists for an employee document that was removed
    for (const record of posted) {
      const empIdStr = String(record.employee);
      if (!processedEmpIds.has(empIdStr)) {
        processedEmpIds.add(empIdStr);
        const doc = SalaryRecord.hydrate(record);
        rows.push({
          employee: {
            _id: record.employee,
            employeeId: '—',
            fullName: '(Archived Staff)',
            designation: '—',
            department: '—',
            status: 'Left',
          },
          salaryRecord: record._id,
          posted: true,
          baseSalary: record.baseSalary,
          allowances: record.allowances || 0,
          advanceDeduction: record.advanceDeduction || 0,
          absenceDeduction: record.absenceDeduction || 0,
          taxDeduction: record.taxDeduction || 0,
          securityDeposit: record.securityDeposit || 0,
          otherDeduction: record.otherDeduction || 0,
          absentDays: record.absentDays || 0,
          attendanceBonus: record.attendanceBonus || 0,
          deductions: record.deductions || 0,
          netSalary: record.netSalary,
          amountPaid: doc.paidAmount(),
          outstanding: doc.outstandingAmount(),
          status: record.status,
          paymentDate: record.paymentDate,
          paymentMethod: record.paymentMethod,
          remarks: record.remarks || '',
          pendingAdvances: [],
        });
      }
    }

    // Sort rows alphabetically by employee name
    rows.sort((a, b) => (a.employee?.fullName || '').localeCompare(b.employee?.fullName || ''));

    const totals = rows.reduce(
      (acc, r) => ({
        headcount: acc.headcount + 1,
        gross: round2(acc.gross + r.baseSalary + r.allowances),
        securityDeposit: round2((acc.securityDeposit || 0) + (r.securityDeposit || 0)),
        deductions: round2(acc.deductions + r.deductions),
        net: round2(acc.net + r.netSalary),
        paid: round2(acc.paid + r.amountPaid),
        outstanding: round2(acc.outstanding + r.outstanding),
      }),
      { headcount: 0, gross: 0, securityDeposit: 0, deductions: 0, net: 0, paid: 0, outstanding: 0 }
    );

    res.json({ month: monthKey, label: formatMonthKey(monthKey), rows, totals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Post and/or pay a salary for one employee
// @route   POST /api/salaries/pay
const paySalary = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus || !currentSession) {
      return res.status(400).json({ message: 'Active campus and academic session context are required' });
    }

    const {
      employee: employeeId, month,
      // NO `= 0` defaults on the three fields that fall back to the employee
      // record: a destructuring default makes the value 0 rather than undefined,
      // and `0 ?? employee.allowances` is 0 — so the fallback below would never
      // fire and the staff member would silently be paid without their
      // allowances. Omitting the field must mean "use what the employee record
      // says", which is exactly what the salary sheet proposed.
      baseSalary, allowances, otherDeduction,
      absenceDeduction = 0, taxDeduction = 0, securityDeposit = 0, absentDays = 0,
      attendanceBonus = 0,
      amountPaid, paymentMethod = 'Bank Transfer', paymentDate, remarks,
      recoverAdvances = true,
    } = req.body;

    const mf = monthFields(month);
    if (!mf) return res.status(400).json({ message: 'Month must look like 2026-08' });

    const employee = await Employee.findOne({ _id: employeeId, campus: currentCampus, isDeleted: false });
    if (!employee) return res.status(404).json({ message: 'Employee not found at this campus' });

    const payDate = paymentDate ? new Date(paymentDate) : defaultPayDate(month);
    await assertMonthsOpen(currentCampus, [payDate]);

    const result = await withTransaction(async (session) => {
      // Outstanding advances to claw back on this sheet.
      let advanceDeduction = 0;
      let recovered = [];
      if (recoverAdvances) {
        const q = SalaryAdvance.find({
          employee: employeeId, campus: currentCampus, status: 'Outstanding',
          isDeleted: false, recoverFromMonth: { $lte: month },
        });
        if (session) q.session(session);
        const open = await q;

        for (const adv of open) {
          const due = adv.instalmentFor(month);
          if (due > 0) {
            advanceDeduction = round2(advanceDeduction + due);
            recovered.push({ doc: adv, amount: due });
          }
        }
      }

      // Each falls back to the employee record, matching what the sheet proposed.
      const base = Number(baseSalary ?? employee.salary ?? 0);
      const allow = Number(allowances ?? employee.allowances ?? 0);
      const otherDed = Number(otherDeduction ?? employee.deductions ?? 0);

      // One record per employee per month — enforced by the existing unique index.
      const q2 = SalaryRecord.findOne({ employee: employeeId, ...mf });
      if (session) q2.session(session);
      let record = await q2;

      if (!record) {
        record = new SalaryRecord({
          employee: employeeId,
          campus: currentCampus,
          academicSession: currentSession,
          ...mf,
          createdBy: req.user?._id,
        });
      }

      const oneDaySalary = base / 30;

      let calcAbsenceDeduction = Number(absenceDeduction || 0);
      let calcAttendanceBonus = Number(attendanceBonus || 0);

      const absDays = Number(absentDays || 0);
      if (absDays > 0) {
        calcAbsenceDeduction = Math.round(absDays * oneDaySalary);
      } else if (absDays === 0 && absenceDeduction === 0) {
        calcAbsenceDeduction = 0;
      }

      // If allowanceDays provided, calculate allowances per day
      let finalAllowances = allow;
      const allowDays = Number(req.body.allowanceDays || 0);
      if (allowDays > 0) {
        finalAllowances = Math.round(allowDays * oneDaySalary);
      }

      // The record's figures are settled BEFORE anything is validated against
      // them. Advances accumulate onto whatever this sheet already recovered, so
      // topping up a part-paid salary cannot deduct the same advance twice.
      record.baseSalary = base;
      record.allowances = finalAllowances;
      record.absenceDeduction = calcAbsenceDeduction;
      record.attendanceBonus = calcAttendanceBonus;
      record.taxDeduction = Number(taxDeduction);
      record.securityDeposit = Number(securityDeposit || 0);
      record.otherDeduction = otherDed;
      record.absentDays = Number(absentDays);
      record.advanceDeduction = round2((record.advanceDeduction || 0) + advanceDeduction);
      record.deductions = round2(
        calcAbsenceDeduction + Number(taxDeduction) + record.securityDeposit + otherDed + record.advanceDeduction
      );

      /**
       * netSalary is rounded up to the nearest 10 (e.g. 7953 -> 7960).
       */
      const rawNet = base + finalAllowances + calcAttendanceBonus - record.deductions;
      if (rawNet < 0) {
        throw Object.assign(
          new Error('Deductions exceed the salary — net pay cannot be negative'),
          { statusCode: 400 }
        );
      }
      const net = roundUp10(rawNet);
      record.netSalary = net;

      const alreadyPaid = record.isNew ? 0 : SalaryRecord.hydrate(record.toObject()).paidAmount();
      const paying = amountPaid === undefined ? round2(net - alreadyPaid) : round2(Number(amountPaid));
      const totalPaid = round2(alreadyPaid + paying);

      if (totalPaid > net) {
        throw Object.assign(
          new Error(
            alreadyPaid > 0
              ? `Rs. ${alreadyPaid.toLocaleString()} has already been paid for ${formatMonthKey(month)}; paying Rs. ${paying.toLocaleString()} more would exceed the net salary of Rs. ${net.toLocaleString()}.`
              : `Payment of Rs. ${paying.toLocaleString()} is more than the net salary of Rs. ${net.toLocaleString()}.`
          ),
          { statusCode: 400 }
        );
      }

      record.amountPaid = totalPaid;
      record.paymentDate = payDate;
      record.paymentMethod = paymentMethod;
      record.remarks = remarks;
      record.updatedBy = req.user?._id;
      record.status = totalPaid >= net ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

      if (paying > 0) {
        record.payments.push({
          amount: paying, date: payDate, method: paymentMethod,
          recordedBy: req.user?._id, remarks,
        });
      }

      for (const r of recovered) {
        record.recoveredAdvances.push({ advance: r.doc._id, amount: r.amount });
      }

      await record.save(sessionOpts(session));

      // Move the advances' recovery along, in the same transaction.
      for (const r of recovered) {
        const nextRecovered = round2((r.doc.amountRecovered || 0) + r.amount);
        await SalaryAdvance.updateOne(
          { _id: r.doc._id },
          {
            $set: {
              amountRecovered: nextRecovered,
              status: nextRecovered >= r.doc.amount ? 'Recovered' : 'Outstanding',
              updatedBy: req.user?._id,
            },
          },
          sessionOpts(session)
        );
      }

      // The cash that actually left, posted to the ledger. Only the amount handed
      // over — the advance recovery reduced it and was already booked when given.
      let expenseId = record.expense;
      if (paying > 0) {
        const category = await salaryCategoryFor(currentCampus, session);
        const created = await Expense.create([{
          campus: currentCampus,
          academicSession: currentSession,
          title: `Salary — ${employee.fullName} (${formatMonthKey(month)})`,
          type: 'Expense',
          category: 'Salary',
          categoryRef: category?._id,
          amount: paying,
          date: payDate,
          paymentMethod: paymentMethod === 'Bank Transfer' ? 'Bank' : paymentMethod,
          paidTo: employee.fullName,
          paidToEmployee: employee._id,
          status: 'Approved',
          approvedBy: req.user?._id,
          approvedAt: new Date(),
          salaryRecord: record._id,
          recordedBy: req.user?._id,
          description: remarks,
        }], sessionOpts(session));
        expenseId = created[0]._id;
        record.expense = expenseId;
        await record.save(sessionOpts(session));
      }

      return { record, advanceDeduction, recovered: recovered.length, paid: paying };
    });

    res.status(201).json({
      message: `Rs. ${result.paid.toLocaleString()} paid to ${employee.fullName} for ${formatMonthKey(month)}`,
      salary: result.record,
      advanceRecovered: result.advanceDeduction,
    });
  } catch (err) {
    if (err instanceof MonthClosedError) {
      return res.status(err.statusCode).json({ message: err.message, month: err.monthKey });
    }
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A salary record already exists for this employee and month.' });
    }
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

// @desc    One salary record, for the printable slip
// @route   GET /api/salaries/:id
const getSalaryRecord = async (req, res) => {
  try {
    const record = await SalaryRecord.findOne({ _id: req.params.id, isDeleted: false })
      .populate('employee', 'fullName employeeId designation department cnic joiningDate')
      .populate('campus', 'name address phone')
      .lean();
    if (!record) return res.status(404).json({ message: 'Salary record not found' });

    const doc = SalaryRecord.hydrate(record);
    res.json({
      ...record,
      amountPaid: doc.paidAmount(),
      outstanding: doc.outstandingAmount(),
      monthKey: monthKeyFromName(record.salaryMonth, record.salaryYear),
      monthLabel: `${record.salaryMonth} ${record.salaryYear}`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update an existing salary record
// @route   PUT /api/salaries/:id
const updateSalaryRecord = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus) {
      return res.status(400).json({ message: 'Active campus context is required' });
    }

    const record = await SalaryRecord.findOne({
      _id: req.params.id,
      campus: currentCampus,
      isDeleted: false,
    });
    if (!record) {
      return res.status(404).json({ message: 'Salary record not found at this campus' });
    }

    const monthKey = monthKeyFromName(record.salaryMonth, record.salaryYear);
    const payDate = req.body.paymentDate
      ? new Date(req.body.paymentDate)
      : (record.paymentDate || defaultPayDate(monthKey));

    // Assert month is not locked/closed
    await assertMonthsOpen(currentCampus, [payDate]);

    const result = await withTransaction(async (session) => {
      const employee = await Employee.findById(record.employee).session(session);

      const base = req.body.baseSalary !== undefined
        ? Number(req.body.baseSalary)
        : Number(record.baseSalary ?? employee?.salary ?? 0);

      const oneDaySalary = base / 30;

      // Allowances: if allowanceDays specified, calculate; else use provided or existing
      let finalAllowances = req.body.allowances !== undefined
        ? Number(req.body.allowances)
        : Number(record.allowances ?? 0);
      if (req.body.allowanceDays !== undefined && Number(req.body.allowanceDays) > 0) {
        finalAllowances = Math.round(Number(req.body.allowanceDays) * oneDaySalary);
      }

      // Absence deduction: if absentDays specified, calculate; else use provided or existing
      const absDays = req.body.absentDays !== undefined ? Number(req.body.absentDays) : Number(record.absentDays ?? 0);
      let calcAbsenceDeduction = req.body.absenceDeduction !== undefined
        ? Number(req.body.absenceDeduction)
        : Number(record.absenceDeduction ?? 0);
      if (req.body.absentDays !== undefined) {
        calcAbsenceDeduction = absDays > 0 ? Math.round(absDays * oneDaySalary) : 0;
      }

      const calcAttendanceBonus = req.body.attendanceBonus !== undefined
        ? Number(req.body.attendanceBonus)
        : Number(record.attendanceBonus ?? 0);

      const advanceDeduction = req.body.advanceDeduction !== undefined
        ? Number(req.body.advanceDeduction)
        : Number(record.advanceDeduction ?? 0);

      const taxDeduction = req.body.taxDeduction !== undefined
        ? Number(req.body.taxDeduction)
        : Number(record.taxDeduction ?? 0);

      const securityDeposit = req.body.securityDeposit !== undefined
        ? Number(req.body.securityDeposit)
        : Number(record.securityDeposit ?? 0);

      const otherDeduction = req.body.otherDeduction !== undefined
        ? Number(req.body.otherDeduction)
        : Number(record.otherDeduction ?? 0);

      const totalDeductions = round2(calcAbsenceDeduction + taxDeduction + securityDeposit + otherDeduction + advanceDeduction);
      const rawNet = base + finalAllowances + calcAttendanceBonus - totalDeductions;
      if (rawNet < 0) {
        throw Object.assign(
          new Error('Deductions exceed the salary — net pay cannot be negative'),
          { statusCode: 400 }
        );
      }
      const net = roundUp10(rawNet);

      // Amount paid:
      // If user supplied amountPaid, use it; otherwise maintain current amountPaid capped to net.
      const currentPaid = SalaryRecord.hydrate(record.toObject()).paidAmount();
      let targetPaid = req.body.amountPaid !== undefined
        ? round2(Number(req.body.amountPaid))
        : currentPaid;

      if (targetPaid > net) {
        throw Object.assign(
          new Error(`Paid amount of Rs. ${targetPaid.toLocaleString()} cannot exceed the net salary of Rs. ${net.toLocaleString()}.`),
          { statusCode: 400 }
        );
      }

      const paymentMethod = req.body.paymentMethod || record.paymentMethod || 'Bank Transfer';
      const remarks = req.body.remarks !== undefined ? req.body.remarks : (record.remarks || '');

      // Status
      let status = req.body.status;
      if (!status) {
        status = targetPaid >= net ? 'Paid' : (targetPaid > 0 ? 'Partial' : 'Pending');
      }

      // Update fields
      record.baseSalary = base;
      record.allowances = finalAllowances;
      record.attendanceBonus = calcAttendanceBonus;
      record.absentDays = absDays;
      record.absenceDeduction = calcAbsenceDeduction;
      record.advanceDeduction = advanceDeduction;
      record.taxDeduction = taxDeduction;
      record.securityDeposit = securityDeposit;
      record.otherDeduction = otherDeduction;
      record.deductions = totalDeductions;
      record.netSalary = net;
      record.amountPaid = targetPaid;
      record.status = status;
      record.paymentDate = payDate;
      record.paymentMethod = paymentMethod;
      record.remarks = remarks;
      record.updatedBy = req.user?._id;

      // Update payments array
      if (targetPaid > 0) {
        record.payments = [{
          amount: targetPaid,
          date: payDate,
          method: paymentMethod,
          recordedBy: req.user?._id,
          remarks: remarks || 'Salary payment',
        }];
      } else {
        record.payments = [];
      }

      await record.save(sessionOpts(session));

      // Handle linked Expense
      if (record.expense) {
        if (targetPaid > 0) {
          await Expense.updateOne(
            { _id: record.expense },
            {
              $set: {
                amount: targetPaid,
                paymentMethod: paymentMethod === 'Bank Transfer' ? 'Bank' : paymentMethod,
                date: payDate,
                paidTo: employee?.fullName || 'Staff',
                title: `Salary — ${employee?.fullName || 'Staff'} (${formatMonthKey(monthKey)})`,
                description: remarks,
                isDeleted: false,
                updatedBy: req.user?._id,
              },
            },
            sessionOpts(session)
          );
        } else {
          // If amount paid was reduced to 0, mark the expense as deleted
          await Expense.updateOne(
            { _id: record.expense },
            { $set: { isDeleted: true, updatedBy: req.user?._id } },
            sessionOpts(session)
          );
        }
      } else if (targetPaid > 0) {
        // Create an Expense if none existed previously
        const category = await salaryCategoryFor(currentCampus, session);
        const created = await Expense.create([{
          campus: currentCampus,
          academicSession: currentSession || record.academicSession,
          title: `Salary — ${employee?.fullName || 'Staff'} (${formatMonthKey(monthKey)})`,
          type: 'Expense',
          category: 'Salary',
          categoryRef: category?._id,
          amount: targetPaid,
          date: payDate,
          paymentMethod: paymentMethod === 'Bank Transfer' ? 'Bank' : paymentMethod,
          paidTo: employee?.fullName || 'Staff',
          paidToEmployee: employee?._id,
          status: 'Approved',
          approvedBy: req.user?._id,
          approvedAt: new Date(),
          salaryRecord: record._id,
          recordedBy: req.user?._id,
          description: remarks,
        }], sessionOpts(session));

        record.expense = created[0]._id;
        await record.save(sessionOpts(session));
      }

      return record;
    });

    res.json({
      message: 'Salary record updated successfully',
      salary: result,
    });
  } catch (err) {
    if (err instanceof MonthClosedError) {
      return res.status(err.statusCode).json({ message: err.message, month: err.monthKey });
    }
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

// ─── Advances ────────────────────────────────────────────────────────────────

// @desc    List advances
// @route   GET /api/salaries/advances
const getAdvances = async (req, res) => {
  try {
    const { currentCampus } = req;
    const query = { campus: currentCampus, isDeleted: false };
    if (req.query.status) query.status = req.query.status;
    if (req.query.employee && mongoose.isValidObjectId(req.query.employee)) {
      query.employee = req.query.employee;
    }

    const advances = await SalaryAdvance.find(query)
      .populate('employee', 'fullName employeeId designation')
      .sort({ dateGiven: -1 })
      .lean();

    const totals = await SalaryAdvance.aggregate([
      { $match: { campus: new mongoose.Types.ObjectId(currentCampus), isDeleted: false, status: 'Outstanding' } },
      { $group: { _id: null, outstanding: { $sum: { $subtract: ['$amount', { $ifNull: ['$amountRecovered', 0] }] } }, count: { $sum: 1 } } },
    ]);

    res.json({
      advances: advances.map(a => ({ ...a, outstanding: Math.max(0, (a.amount || 0) - (a.amountRecovered || 0)) })),
      totals: { outstanding: totals[0]?.outstanding || 0, count: totals[0]?.count || 0 },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Give a salary advance (posts the cash outflow)
// @route   POST /api/salaries/advances
const createAdvance = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus || !currentSession) {
      return res.status(400).json({ message: 'Active campus and academic session context are required' });
    }

    const { employee: employeeId, amount, dateGiven, reason, recoverFromMonth, monthlyInstalment = 0 } = req.body;

    const employee = await Employee.findOne({ _id: employeeId, campus: currentCampus, isDeleted: false });
    if (!employee) return res.status(404).json({ message: 'Employee not found at this campus' });

    const given = dateGiven ? new Date(dateGiven) : new Date();
    await assertMonthsOpen(currentCampus, [given]);

    const result = await withTransaction(async (session) => {
      const created = await SalaryAdvance.create([{
        employee: employeeId,
        campus: currentCampus,
        academicSession: currentSession,
        amount,
        dateGiven: given,
        reason,
        recoverFromMonth,
        monthlyInstalment,
        status: 'Outstanding',
        createdBy: req.user?._id,
      }], sessionOpts(session));

      const advance = created[0];

      // The advance is cash leaving today, so it is booked today. Recovering it
      // later is a deduction on the sheet, never a second expense.
      const category = await salaryCategoryFor(currentCampus, session);
      const expense = await Expense.create([{
        campus: currentCampus,
        academicSession: currentSession,
        title: `Salary advance — ${employee.fullName}`,
        type: 'Expense',
        category: 'Salary',
        categoryRef: category?._id,
        amount,
        date: given,
        paidTo: employee.fullName,
        paidToEmployee: employee._id,
        status: 'Approved',
        approvedBy: req.user?._id,
        approvedAt: new Date(),
        recordedBy: req.user?._id,
        description: reason,
      }], sessionOpts(session));

      advance.expense = expense[0]._id;
      await advance.save(sessionOpts(session));
      return advance;
    });

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof MonthClosedError) {
      return res.status(err.statusCode).json({ message: err.message, month: err.monthKey });
    }
    res.status(err.statusCode || 400).json({ message: err.message });
  }
};

// @desc    Cancel an advance that has not been recovered against
// @route   DELETE /api/salaries/advances/:id
const cancelAdvance = async (req, res) => {
  try {
    const advance = await SalaryAdvance.findOne({
      _id: req.params.id, campus: req.currentCampus, isDeleted: false,
    });
    if (!advance) return res.status(404).json({ message: 'Advance not found' });

    if ((advance.amountRecovered || 0) > 0) {
      return res.status(400).json({
        message: `Rs. ${advance.amountRecovered.toLocaleString()} has already been recovered from this advance, so it cannot be cancelled.`,
      });
    }

    await assertMonthsOpen(advance.campus, [advance.dateGiven]);

    await withTransaction(async (session) => {
      advance.status = 'Cancelled';
      advance.isDeleted = true;
      advance.updatedBy = req.user?._id;
      await advance.save(sessionOpts(session));

      // The outflow it booked goes with it.
      if (advance.expense) {
        await Expense.updateOne(
          { _id: advance.expense },
          { $set: { isDeleted: true, updatedBy: req.user?._id } },
          sessionOpts(session)
        );
      }
    });

    res.json({ message: 'Advance cancelled' });
  } catch (err) {
    if (err instanceof MonthClosedError) {
      return res.status(err.statusCode).json({ message: err.message, month: err.monthKey });
    }
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getSalarySheet,
  paySalary,
  getSalaryRecord,
  updateSalaryRecord,
  getAdvances,
  createAdvance,
  cancelAdvance,
};
