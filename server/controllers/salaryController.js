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

    // Three bounded reads — a school's staff list, this month's postings, and the
    // open advances — merged below. Nothing here scans a large collection.
    const [employees, posted, advances] = await Promise.all([
      Employee.find({ campus: currentCampus, isDeleted: false, status: 'Active' })
        .select('employeeId fullName designation department salary allowances deductions')
        .sort({ fullName: 1 })
        .lean(),
      SalaryRecord.find({ campus: currentCampus, ...mf, isDeleted: false }).lean(),
      SalaryAdvance.find({
        campus: currentCampus, status: 'Outstanding', isDeleted: false,
      }).lean(),
    ]);

    const postedBy = new Map(posted.map((p) => [String(p.employee), p]));

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

    const rows = employees.map((emp) => {
      const record = postedBy.get(String(emp._id));
      const pendingAdvances = advancesBy.get(String(emp._id)) || [];
      const advanceDue = round2(pendingAdvances.reduce((s, a) => s + a.amount, 0));

      if (record) {
        // Already posted — report what it says, using the legacy-safe fallback so
        // a record written before part-payments existed reads as fully paid.
        const doc = SalaryRecord.hydrate(record);
        return {
          employee: { _id: emp._id, employeeId: emp.employeeId, fullName: emp.fullName, designation: emp.designation, department: emp.department },
          salaryRecord: record._id,
          posted: true,
          baseSalary: record.baseSalary,
          allowances: record.allowances || 0,
          advanceDeduction: record.advanceDeduction || 0,
          absenceDeduction: record.absenceDeduction || 0,
          taxDeduction: record.taxDeduction || 0,
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
          pendingAdvances,
        };
      }

      // Not posted yet — a proposal built from the employee record, with any
      // outstanding advance already suggested as a deduction.
      const base = emp.salary || 0;
      const allowances = emp.allowances || 0;
      const standing = emp.deductions || 0;

      let proposedAbsenceDeduction = 0;
      let proposedAttendanceBonus = 0;

      const deductions = round2(standing + advanceDue + proposedAbsenceDeduction);
      const net = round2(base + allowances + proposedAttendanceBonus - deductions);

      return {
        employee: { _id: emp._id, employeeId: emp.employeeId, fullName: emp.fullName, designation: emp.designation, department: emp.department },
        salaryRecord: null,
        posted: false,
        baseSalary: base,
        allowances,
        advanceDeduction: advanceDue,
        absenceDeduction: proposedAbsenceDeduction,
        taxDeduction: 0,
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
        pendingAdvances,
      };
    });

    const totals = rows.reduce(
      (acc, r) => ({
        headcount: acc.headcount + 1,
        gross: round2(acc.gross + r.baseSalary + r.allowances),
        deductions: round2(acc.deductions + r.deductions),
        net: round2(acc.net + r.netSalary),
        paid: round2(acc.paid + r.amountPaid),
        outstanding: round2(acc.outstanding + r.outstanding),
      }),
      { headcount: 0, gross: 0, deductions: 0, net: 0, paid: 0, outstanding: 0 }
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
      absenceDeduction = 0, taxDeduction = 0, absentDays = 0,
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
      record.otherDeduction = otherDed;
      record.absentDays = Number(absentDays);
      record.advanceDeduction = round2((record.advanceDeduction || 0) + advanceDeduction);
      record.deductions = round2(
        calcAbsenceDeduction + Number(taxDeduction) + otherDed + record.advanceDeduction
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
  getAdvances,
  createAdvance,
  cancelAdvance,
};
