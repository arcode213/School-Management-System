const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const SalaryRecord = require('../models/SalaryRecord');
const Campus = require('../models/Campus');
const FeeRecord = require('../models/FeeRecord');
const FeePayment = require('../models/FeePayment');
const { sendWorkbook, sendPdf } = require('../utils/exporters');
const { getLedgerRows } = require('./accountsController');
const {
  monthRange, formatMonthKey, currentMonthKey, monthsOfYear,
  monthKeyExpr, TIMEZONE, MONTH_NAMES, partsOf, ledgerMonthOf,
} = require('../utils/ledgerMonth');

/**
 * Downloadable reports: profit & loss, the expense ledger, and the salary sheet.
 *
 * Each endpoint answers in whichever format `?format=` asks for, from one query —
 * the report is defined once and rendered twice, so the PDF and the spreadsheet
 * can never disagree about the figures.
 *
 * Amounts go into Excel as numbers, not as "Rs. 1,200" strings, so the recipient
 * can sum and pivot them. The PDF formats them for reading.
 */

const fmtMoney = (n) => {
  const v = Number(n) || 0;
  return `${v < 0 ? '-' : ''}Rs. ${Math.abs(v).toLocaleString('en-PK', {
    minimumFractionDigits: Math.abs(v % 1) > 0.004 ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
};

const oid = (v) => new mongoose.Types.ObjectId(v);

/** The header block every report carries. */
const metaFor = async (req, extra = []) => {
  const campus = req.currentCampus
    ? await Campus.findById(req.currentCampus).select('name').lean()
    : null;
  return {
    campusName: campus?.name || 'All Campuses',
    meta: [
      `Campus: ${campus?.name || 'All'}`,
      ...extra,
      `Timezone: ${TIMEZONE}`,
      `Printed: ${new Date().toLocaleString('en-GB')}`,
    ],
  };
};

const dispatch = (res, format, spec, filename) =>
  format === 'pdf'
    ? sendPdf(res, { ...spec, fmtMoney }, filename)
    : sendWorkbook(res, spec, filename);

// @desc    Profit & loss across a range of months
// @route   GET /api/accounts/exports/pnl?from=&to=&format=xlsx|pdf
const exportPnl = async (req, res) => {
  try {
    const { currentCampus } = req;
    if (!currentCampus) return res.status(400).json({ message: 'An active campus is required' });

    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
    const to = req.query.to || currentMonthKey();
    const from = req.query.from || monthsOfYear(Number(to.slice(0, 4)))[0];

    // The ledger already knows how to chain opening balances month to month;
    // re-deriving it here would be a second implementation to keep in step.
    const ledger = await getLedgerRows(currentCampus, from, to);
    if (!ledger) return res.status(400).json({ message: 'Invalid month range' });

    const { campusName, meta } = await metaFor(req, [`Period: ${formatMonthKey(from)} – ${formatMonthKey(to)}`]);

    const columns = [
      { header: 'Month', key: 'label', width: 18, weight: 1.4 },
      { header: 'Opening', key: 'openingBalance', width: 16, money: true, weight: 1 },
      { header: 'Fee Income', key: 'feeIncome', width: 16, money: true, weight: 1 },
      { header: 'Other Income', key: 'otherIncome', width: 16, money: true, weight: 1 },
      { header: 'Total Income', key: 'totalIncome', width: 16, money: true, weight: 1 },
      { header: 'Expenses', key: 'totalExpense', width: 16, money: true, weight: 1 },
      { header: 'Net', key: 'net', width: 16, money: true, weight: 1 },
      { header: 'Closing', key: 'closingBalance', width: 16, money: true, weight: 1 },
    ];

    const totals = ledger.rows.reduce((a, r) => ({
      feeIncome: a.feeIncome + r.feeIncome,
      otherIncome: a.otherIncome + r.otherIncome,
      totalIncome: a.totalIncome + r.totalIncome,
      totalExpense: a.totalExpense + r.totalExpense,
      net: a.net + r.net,
    }), { feeIncome: 0, otherIncome: 0, totalIncome: 0, totalExpense: 0, net: 0 });
    // Opening and closing are positions, not sums — the period's opening is the
    // first month's and its closing is the last month's.
    totals.openingBalance = ledger.rows[0]?.openingBalance ?? 0;
    totals.closingBalance = ledger.rows[ledger.rows.length - 1]?.closingBalance ?? 0;

    await dispatch(res, format, {
      name: 'Profit & Loss',
      title: campusName,
      subtitle: `Profit & Loss — ${formatMonthKey(from)} to ${formatMonthKey(to)}`,
      meta,
      columns,
      rows: ledger.rows,
      totals,
      footNote:
        'Income is fee money received in the month, taken from the receipt ledger. ' +
        'Expenses are approved entries only — bills still awaiting confirmation are excluded. ' +
        'Closing balance carries forward as the next month\'s opening balance.',
    }, `PnL_${from}_to_${to}`);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    The expense ledger for a period
// @route   GET /api/accounts/exports/expenses?month=|from=&to=&type=&format=
const exportExpenses = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus) return res.status(400).json({ message: 'An active campus is required' });

    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
    const { month, dateFrom, dateTo, type, categoryRef, paymentMethod } = req.query;

    const query = { campus: oid(currentCampus), isDeleted: false, ...Expense.APPROVED_MATCH };
    if (currentSession) query.academicSession = oid(currentSession);
    if (type) query.type = type;
    if (categoryRef && mongoose.isValidObjectId(categoryRef)) query.categoryRef = oid(categoryRef);
    if (paymentMethod) query.paymentMethod = paymentMethod;

    let periodLabel = 'All records';
    if (month) {
      const r = monthRange(month);
      if (r) { query.date = { $gte: r.start, $lt: r.end }; periodLabel = formatMonthKey(month); }
    } else if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) { const e = new Date(dateTo); e.setHours(23, 59, 59, 999); query.date.$lte = e; }
      periodLabel = `${dateFrom || 'start'} to ${dateTo || 'today'}`;
    }

    const rows = await Expense.aggregate([
      { $match: query },
      { $lookup: { from: 'expensecategories', localField: 'categoryRef', foreignField: '_id', as: 'cat' } },
      { $lookup: { from: 'users', localField: 'recordedBy', foreignField: '_id', as: 'user' } },
      { $sort: { date: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: '%d-%m-%Y', date: '$date', timezone: TIMEZONE } },
          title: 1,
          type: 1,
          category: { $ifNull: [{ $first: '$cat.name' }, '$category'] },
          subCategory: { $ifNull: ['$subCategory', ''] },
          paidTo: { $ifNull: ['$paidTo', ''] },
          paymentMethod: { $ifNull: ['$paymentMethod', ''] },
          recordedBy: { $ifNull: [{ $first: '$user.name' }, ''] },
          // Income is signed positive and expense negative, so the column sums to
          // the period's net movement rather than to a meaningless gross.
          amount: { $cond: [{ $eq: ['$type', 'Income'] }, '$amount', { $multiply: ['$amount', -1] }] },
        },
      },
    ]);

    const { campusName, meta } = await metaFor(req, [`Period: ${periodLabel}`, `${rows.length} entries`]);

    await dispatch(res, format, {
      name: 'Expense Ledger',
      title: campusName,
      subtitle: `Expense Ledger — ${periodLabel}`,
      meta,
      columns: [
        { header: 'Date', key: 'date', width: 12, weight: 1 },
        { header: 'Title', key: 'title', width: 28, weight: 2 },
        { header: 'Type', key: 'type', width: 10, weight: 0.8 },
        { header: 'Category', key: 'category', width: 20, weight: 1.4 },
        { header: 'Sub-category', key: 'subCategory', width: 18, weight: 1.2 },
        { header: 'Paid To', key: 'paidTo', width: 20, weight: 1.2 },
        { header: 'Method', key: 'paymentMethod', width: 12, weight: 0.9 },
        { header: 'Recorded By', key: 'recordedBy', width: 18, weight: 1.1 },
        { header: 'Amount', key: 'amount', width: 16, money: true, weight: 1.1 },
      ],
      rows,
      totals: { amount: rows.reduce((s, r) => s + r.amount, 0) },
      footNote:
        'Income is shown positive and expenditure negative, so the Amount column totals the net movement. ' +
        'Only approved entries are included.',
    }, `Expense_Ledger_${month || 'all'}`);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    The salary sheet for a month
// @route   GET /api/salaries/exports/sheet?month=&format=
const exportSalarySheet = async (req, res) => {
  try {
    const { currentCampus } = req;
    if (!currentCampus) return res.status(400).json({ message: 'An active campus is required' });

    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
    const month = req.query.month || currentMonthKey();
    const parts = partsOf(month);
    if (!parts) return res.status(400).json({ message: 'Month must look like 2026-08' });

    const rows = await SalaryRecord.aggregate([
      {
        $match: {
          campus: oid(currentCampus),
          salaryMonth: MONTH_NAMES[parts.month - 1],
          salaryYear: parts.year,
          isDeleted: false,
        },
      },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'emp' } },
      { $sort: { 'emp.fullName': 1 } },
      {
        $project: {
          _id: 0,
          employeeId: { $ifNull: [{ $first: '$emp.employeeId' }, ''] },
          fullName: { $ifNull: [{ $first: '$emp.fullName' }, '(removed)'] },
          designation: { $ifNull: [{ $first: '$emp.designation' }, ''] },
          baseSalary: 1,
          allowances: { $ifNull: ['$allowances', 0] },
          advanceDeduction: { $ifNull: ['$advanceDeduction', 0] },
          otherDeductions: {
            $add: [
              { $ifNull: ['$absenceDeduction', 0] },
              { $ifNull: ['$taxDeduction', 0] },
              { $ifNull: ['$otherDeduction', 0] },
            ],
          },
          netSalary: 1,
          // Legacy records carry no `amountPaid`; the same fallback the model uses.
          amountPaid: SalaryRecord.paidAmountExpr(),
          status: 1,
        },
      },
    ]);

    const withOutstanding = rows.map(r => ({
      ...r,
      outstanding: Math.round(((r.netSalary || 0) - (r.amountPaid || 0)) * 100) / 100,
    }));

    const totals = withOutstanding.reduce((a, r) => ({
      baseSalary: a.baseSalary + (r.baseSalary || 0),
      allowances: a.allowances + (r.allowances || 0),
      advanceDeduction: a.advanceDeduction + (r.advanceDeduction || 0),
      otherDeductions: a.otherDeductions + (r.otherDeductions || 0),
      netSalary: a.netSalary + (r.netSalary || 0),
      amountPaid: a.amountPaid + (r.amountPaid || 0),
      outstanding: a.outstanding + r.outstanding,
    }), {
      baseSalary: 0, allowances: 0, advanceDeduction: 0,
      otherDeductions: 0, netSalary: 0, amountPaid: 0, outstanding: 0,
    });

    const { campusName, meta } = await metaFor(req, [
      `Month: ${formatMonthKey(month)}`,
      `${withOutstanding.length} staff`,
    ]);

    await dispatch(res, format, {
      name: 'Salary Sheet',
      title: campusName,
      subtitle: `Salary Sheet — ${formatMonthKey(month)}`,
      meta,
      columns: [
        { header: 'Emp ID', key: 'employeeId', width: 12, weight: 0.9 },
        { header: 'Name', key: 'fullName', width: 26, weight: 1.8 },
        { header: 'Designation', key: 'designation', width: 16, weight: 1.2 },
        { header: 'Basic', key: 'baseSalary', width: 14, money: true, weight: 1 },
        { header: 'Allowances', key: 'allowances', width: 14, money: true, weight: 1 },
        { header: 'Advance', key: 'advanceDeduction', width: 14, money: true, weight: 1 },
        { header: 'Other Ded.', key: 'otherDeductions', width: 14, money: true, weight: 1 },
        { header: 'Net', key: 'netSalary', width: 14, money: true, weight: 1 },
        { header: 'Paid', key: 'amountPaid', width: 14, money: true, weight: 1 },
        { header: 'Outstanding', key: 'outstanding', width: 14, money: true, weight: 1 },
        { header: 'Status', key: 'status', width: 12, weight: 0.9 },
      ],
      rows: withOutstanding,
      totals,
      footNote:
        'Advance recovery is a deduction from net pay, not a separate expense — the advance was ' +
        'recorded as an expense on the day it was handed over. Only staff with a posted salary appear here.',
    }, `Salary_Sheet_${month}`);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    The fee summary report (opening balance + details + summary)
// @route   GET /api/fees/exports/summary?month=&startDate=&endDate=&format=
const exportFeeSummary = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus) return res.status(400).json({ message: 'An active campus is required' });

    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
    const { month, startDate, endDate } = req.query;

    const query = { campus: oid(currentCampus), isDeleted: false, isOpeningBalance: { $ne: true } };
    if (currentSession) query.academicSession = oid(currentSession);

    let periodLabel = 'All records';
    let monthKey = currentMonthKey();

    if (month) {
      const parts = partsOf(month);
      if (parts) {
        query.feeMonth = MONTH_NAMES[parts.month - 1];
        query.feeYear = parts.year;
        periodLabel = formatMonthKey(month);
        monthKey = month;
      }
    } else if (startDate || endDate) {
      const payDateCond = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        payDateCond.$gte = start;
        monthKey = ledgerMonthOf(start);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        payDateCond.$lte = end;
        if (!monthKey) monthKey = ledgerMonthOf(end);
      }

      const paymentQuery = {
        receivedOn: payDateCond,
        isDeleted: { $ne: true },
        amount: { $gt: 0 },
      };
      if (currentCampus) paymentQuery.campus = oid(currentCampus);
      if (currentSession) paymentQuery.academicSession = oid(currentSession);

      const paymentFeeIds = await FeePayment.distinct('feeRecord', paymentQuery);

      query.$or = [
        { paymentDate: payDateCond },
        { _id: { $in: paymentFeeIds } },
      ];
      periodLabel = `${startDate || 'start'} to ${endDate || 'today'}`;
    }

    const { openingBalanceFor } = require('./accountsController');
    const opening = await openingBalanceFor(currentCampus, monthKey);

    const fees = await FeeRecord.aggregate([
      { $match: query },
      { $lookup: { from: 'studentacademicrecords', localField: 'studentAcademicRecord', foreignField: '_id', as: 'academicInfo' } },
      { $unwind: { path: '$academicInfo', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'studentInfo' } },
      { $unwind: { path: '$studentInfo', preserveNullAndEmptyArrays: true } },
      { $sort: { challanNo: 1 } },
      {
        $project: {
          _id: 0,
          challanNo: 1,
          studentId: { $ifNull: ['$studentInfo.studentId', ''] },
          fullName: { $ifNull: ['$studentInfo.fullName', ''] },
          className: { $ifNull: ['$academicInfo.className', ''] },
          section: { $ifNull: ['$academicInfo.section', ''] },
          dueMonthRange: 1,
          previousDues: { $ifNull: ['$previousDues', 0] },
          tuitionFee: { $ifNull: ['$tuitionFee', 0] },
          transportFee: { $ifNull: ['$transportFee', 0] },
          miscFee: { $ifNull: ['$miscFee', 0] },
          examFee: { $ifNull: ['$examFee', 0] },
          annualFee: { $ifNull: ['$annualFee', 0] },
          previousAnnualDues: { $ifNull: ['$previousAnnualDues', 0] },
          totalAmount: { $ifNull: ['$totalAmount', 0] },
          amountPaid: { $ifNull: ['$amountPaid', 0] },
          balance: { $ifNull: ['$balance', 0] },
          status: 1,
          paymentDate: 1,
        }
      }
    ]);

    const formattedRows = fees.map(f => {
      const classText = `Class ${f.className || ''} ${f.section || ''}`.trim();
      const pDate = f.paymentDate ? new Date(f.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      return {
        ...f,
        classSection: classText,
        currentFees: f.tuitionFee + f.transportFee + f.miscFee + f.examFee,
        totalAnnualFee: f.annualFee + f.previousAnnualDues,
        payDate: pDate,
      };
    });

    const totals = formattedRows.reduce((a, r) => ({
      previousDues: a.previousDues + r.previousDues,
      currentFees: a.currentFees + r.currentFees,
      totalAnnualFee: a.totalAnnualFee + r.totalAnnualFee,
      totalAmount: a.totalAmount + r.totalAmount,
      amountPaid: a.amountPaid + r.amountPaid,
      balance: a.balance + r.balance,
    }), { previousDues: 0, currentFees: 0, totalAnnualFee: 0, totalAmount: 0, amountPaid: 0, balance: 0 });

    const { campusName, meta } = await metaFor(req, [
      `Period: ${periodLabel}`,
      `Monthly Opening Balance: Rs. ${opening.amount.toLocaleString()}`,
      `Total Fee Collected: Rs. ${totals.amountPaid.toLocaleString()}`,
      `Closing Cash Balance: Rs. ${(opening.amount + totals.amountPaid).toLocaleString()}`,
      `Total Dues Outstanding: Rs. ${totals.balance.toLocaleString()}`,
      `${formattedRows.length} challans`,
    ]);

    await dispatch(res, format, {
      name: 'Fee Summary',
      title: campusName,
      subtitle: `Fee Collection & Dues Summary — ${periodLabel}`,
      meta,
      columns: [
        { header: 'Challan No', key: 'challanNo', width: 14, weight: 1 },
        { header: 'Student ID', key: 'studentId', width: 12, weight: 0.9 },
        { header: 'Student Name', key: 'fullName', width: 22, weight: 1.6 },
        { header: 'Class', key: 'classSection', width: 14, weight: 1 },
        { header: 'Due Months', key: 'dueMonthRange', width: 14, weight: 1 },
        { header: 'Prev. Dues', key: 'previousDues', width: 12, money: true, weight: 0.9 },
        { header: 'Monthly Fees', key: 'currentFees', width: 12, money: true, weight: 0.9 },
        { header: 'Annual Fee', key: 'totalAnnualFee', width: 12, money: true, weight: 0.9 },
        { header: 'Total Amount', key: 'totalAmount', width: 13, money: true, weight: 1 },
        { header: 'Paid', key: 'amountPaid', width: 12, money: true, weight: 0.9 },
        { header: 'Dues', key: 'balance', width: 12, money: true, weight: 0.9 },
        { header: 'Status', key: 'status', width: 10, weight: 0.8 },
        { header: 'Payment Date', key: 'payDate', width: 14, weight: 1.1 },
      ],
      rows: formattedRows,
      totals,
      footNote:
        `Monthly Opening Balance: Rs. ${opening.amount.toLocaleString()}  |  ` +
        `Total Fee Collected: Rs. ${totals.amountPaid.toLocaleString()}  |  ` +
        `Closing Cash Balance: Rs. ${(opening.amount + totals.amountPaid).toLocaleString()}  |  ` +
        `Total Dues Outstanding: Rs. ${totals.balance.toLocaleString()}\n` +
        `Only non-opening-balance active challans are included.`,
    }, `Fee_Summary_${month || 'all'}`);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { exportPnl, exportExpenses, exportSalarySheet, exportFeeSummary };
