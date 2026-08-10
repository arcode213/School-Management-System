const mongoose = require('mongoose');
const FeePayment = require('../models/FeePayment');
const Expense = require('../models/Expense');
const ClosedMonth = require('../models/ClosedMonth');
const { withTransaction, sessionOpts } = require('../utils/transaction');
const { seedExpenseCategories } = require('../utils/seedExpenseCategories');
const { generateDueRecurring } = require('./recurringExpenseController');
const {
  TIMEZONE, monthKeyExpr, monthRange, currentMonthKey, previousMonth,
  monthsBetween, formatMonthKey, monthsOfYear,
} = require('../utils/ledgerMonth');

/**
 * The monthly ledger: Opening Balance → Income → Expenses → Net Balance.
 *
 * INCOME IS AUTOMATIC. It is the fee money actually received in the month, read
 * from the FeePayment receipt ledger — paying a challan is what creates income,
 * and nothing is entered by hand. Any manually recorded `type: 'Income'` rows
 * from the older Expenses screen are added on top so historical books do not
 * shift, but nothing in this module creates them.
 *
 * EXPENSES are approved rows only. A pending recurring bill is a liability, not
 * money that has left, so it is reported separately and excluded from the net.
 *
 * Every total here comes from an aggregation pipeline. Summing in JavaScript
 * would mean pulling whole collections into memory, and these grow with every
 * receipt the school takes.
 */

const oid = (v) => new mongoose.Types.ObjectId(v);

/** Fee receipts grouped by the Karachi month they were received in. */
const feeIncomeByMonth = async (campus, from, to) => {
  const range = { $gte: monthRange(from).start, $lt: monthRange(to).end };
  return FeePayment.aggregate([
    { $match: { campus: oid(campus), isDeleted: false, receivedOn: range } },
    {
      $lookup: {
        from: 'feerecords',
        localField: 'feeRecord',
        foreignField: '_id',
        as: 'feeRecordDoc'
      }
    },
    { $unwind: { path: '$feeRecordDoc', preserveNullAndEmptyArrays: true } },
    { $match: { 'feeRecordDoc.isOpeningBalance': { $ne: true } } },
    { $group: { _id: monthKeyExpr('$receivedOn'), total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
};

/**
 * Expense rows grouped by month and type.
 *
 * `Expense.APPROVED_MATCH` rather than `status: 'Approved'` — records written
 * before this module have no status field at all and would otherwise vanish.
 */
const expensesByMonth = async (campus, from, to) => {
  const range = { $gte: monthRange(from).start, $lt: monthRange(to).end };
  return Expense.aggregate([
    { $match: { campus: oid(campus), isDeleted: false, date: range, ...Expense.APPROVED_MATCH } },
    {
      $group: {
        _id: { month: monthKeyExpr('$date'), type: '$type' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);
};

/** Raised-but-unconfirmed bills, which are excluded from the net balance. */
const pendingByMonth = async (campus, from, to) => {
  const range = { $gte: monthRange(from).start, $lt: monthRange(to).end };
  return Expense.aggregate([
    { $match: { campus: oid(campus), isDeleted: false, date: range, status: 'Pending' } },
    { $group: { _id: monthKeyExpr('$date'), total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
};

/**
 * The opening balance for a month.
 *
 * Prefers the snapshot on the previous month's closing record — that is a
 * recorded fact and makes the chain explicit. With no closed month behind it,
 * falls back to everything that has ever moved before this month, so a school
 * that has never closed a month still gets a truthful running balance.
 */
const openingBalanceFor = async (campus, monthKey) => {
  const prev = previousMonth(monthKey);

  const closed = await ClosedMonth.findOne({ campus: campus, month: prev, isClosed: true })
    .select('netBalance').lean();
  if (closed) return { amount: closed.netBalance || 0, source: 'closing', from: prev };

  const start = monthRange(monthKey).start;

  const [income, expense] = await Promise.all([
    FeePayment.aggregate([
      { $match: { campus: oid(campus), isDeleted: false, receivedOn: { $lt: start } } },
      {
        $lookup: {
          from: 'feerecords',
          localField: 'feeRecord',
          foreignField: '_id',
          as: 'feeRecordDoc'
        }
      },
      { $unwind: { path: '$feeRecordDoc', preserveNullAndEmptyArrays: true } },
      { $match: { 'feeRecordDoc.isOpeningBalance': { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Expense.aggregate([
      { $match: { campus: oid(campus), isDeleted: false, date: { $lt: start }, ...Expense.APPROVED_MATCH } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
  ]);

  const feeIn = income[0]?.total || 0;
  const otherIn = expense.find(e => e._id === 'Income')?.total || 0;
  const out = expense.find(e => e._id === 'Expense')?.total || 0;

  return { amount: Math.round((feeIn + otherIn - out) * 100) / 100, source: 'derived', from: prev };
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * The ledger rows for a campus over a month range.
 *
 * Extracted from the route handler so the P&L export builds on exactly the same
 * figures the screen shows. A second implementation for the download is how a
 * report ends up disagreeing with the page it was printed from.
 *
 * Returns null for an invalid or oversized range; the caller decides the message.
 */
const getLedgerRows = async (currentCampus, from, to) => {
  const months = monthsBetween(from, to);
  if (months.length === 0 || months.length > 36) return null;

  const [fees, expenses, pending, closedRows, opening] = await Promise.all([
    feeIncomeByMonth(currentCampus, from, to),
    expensesByMonth(currentCampus, from, to),
    pendingByMonth(currentCampus, from, to),
    ClosedMonth.find({ campus: currentCampus, month: { $in: months } }).lean(),
    openingBalanceFor(currentCampus, from),
  ]);

  const feeBy = new Map(fees.map(f => [f._id, f]));
  const pendingBy = new Map(pending.map(p => [p._id, p]));
  const closedBy = new Map(closedRows.map(c => [c.month, c]));
  const expBy = new Map();
  for (const e of expenses) {
    const row = expBy.get(e._id.month) || { income: 0, expense: 0 };
    if (e._id.type === 'Income') row.income = e.total; else row.expense = e.total;
    expBy.set(e._id.month, row);
  }

  // The balance carries forward month to month — the one place a loop is
  // correct, because each month depends on the one before it.
  let carried = opening.amount;
  const rows = months.map((month) => {
    const feeIncome = feeBy.get(month)?.total || 0;
    const other = expBy.get(month) || { income: 0, expense: 0 };
    const totalIncome = round2(feeIncome + other.income);
    const totalExpense = round2(other.expense);
    const net = round2(totalIncome - totalExpense);
    const openingBalance = carried;
    const closingBalance = round2(openingBalance + net);
    carried = closingBalance;

    const closed = closedBy.get(month);
    return {
      month,
      label: formatMonthKey(month),
      openingBalance,
      feeIncome: round2(feeIncome),
      otherIncome: round2(other.income),
      totalIncome,
      totalExpense,
      net,
      closingBalance,
      pendingExpense: round2(pendingBy.get(month)?.total || 0),
      pendingCount: pendingBy.get(month)?.count || 0,
      receiptCount: feeBy.get(month)?.count || 0,
      isClosed: Boolean(closed?.isClosed),
      closedAt: closed?.closedAt || null,
    };
  });

  return { from, to, openingBalance: opening, rows };
};

// @desc    The monthly ledger across a range of months
// @route   GET /api/accounts/ledger?from=2026-01&to=2026-12
const getLedger = async (req, res) => {
  try {
    const { currentCampus } = req;
    if (!currentCampus) return res.status(400).json({ message: 'An active campus is required' });

    const to = req.query.to || currentMonthKey();
    const from = req.query.from || monthsOfYear(Number(to.slice(0, 4)))[0];

    if (monthsBetween(from, to).length === 0) {
      return res.status(400).json({ message: 'The "from" month must not be after the "to" month' });
    }

    const ledger = await getLedgerRows(currentCampus, from, to);
    if (!ledger) {
      return res.status(400).json({ message: 'Please request a range of 36 months or fewer' });
    }

    const { rows } = ledger;
    res.json({
      ...ledger,
      totals: rows.reduce((a, r) => ({
        income: round2(a.income + r.totalIncome),
        expense: round2(a.expense + r.totalExpense),
        net: round2(a.net + r.net),
        pending: round2(a.pending + r.pendingExpense),
      }), { income: 0, expense: 0, net: 0, pending: 0 }),
      closingBalance: rows.length ? rows[rows.length - 1].closingBalance : ledger.openingBalance.amount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Dashboard summary for one month: cards, category split, month-on-month
// @route   GET /api/accounts/summary?month=2026-08
const getSummary = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus) return res.status(400).json({ message: 'An active campus is required' });

    const month = req.query.month || currentMonthKey();
    const range = monthRange(month);
    if (!range) return res.status(400).json({ message: 'Month must look like 2026-08' });

    // Opening the accounts screen is what raises any recurring bills that have
    // fallen due — see recurringExpenseController for why this is not a cron.
    if (currentSession) {
      generateDueRecurring({
        campus: currentCampus, academicSession: currentSession, userId: req.user?._id,
      }).catch(err => console.error('[recurring] generation failed:', err.message));
    }
    await seedExpenseCategories(currentCampus, req.user?._id);

    const campusId = oid(currentCampus);
    const dateRange = { $gte: range.start, $lt: range.end };

    const [feeAgg, expenseAgg, pendingAgg, byCategory, opening, closed] = await Promise.all([
      FeePayment.aggregate([
        { $match: { campus: campusId, isDeleted: false, receivedOn: dateRange } },
        {
          $lookup: {
            from: 'feerecords',
            localField: 'feeRecord',
            foreignField: '_id',
            as: 'feeRecordDoc'
          }
        },
        { $unwind: { path: '$feeRecordDoc', preserveNullAndEmptyArrays: true } },
        { $match: { 'feeRecordDoc.isOpeningBalance': { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { campus: campusId, isDeleted: false, date: dateRange, ...Expense.APPROVED_MATCH } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { campus: campusId, isDeleted: false, date: dateRange, status: 'Pending' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      // Category-wise breakdown. The lookup resolves the configurable category;
      // rows that predate it fall back to their legacy string.
      Expense.aggregate([
        { $match: { campus: campusId, isDeleted: false, date: dateRange, type: 'Expense', ...Expense.APPROVED_MATCH } },
        {
          $lookup: {
            from: 'expensecategories', localField: 'categoryRef',
            foreignField: '_id', as: 'cat',
          },
        },
        {
          $group: {
            _id: { $ifNull: [{ $first: '$cat.name' }, '$category'] },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      openingBalanceFor(currentCampus, month),
      ClosedMonth.findOne({ campus: currentCampus, month }).lean(),
    ]);

    const feeIncome = feeAgg[0]?.total || 0;
    const otherIncome = expenseAgg.find(e => e._id === 'Income')?.total || 0;
    const totalIncome = round2(feeIncome + otherIncome);
    const totalExpense = round2(expenseAgg.find(e => e._id === 'Expense')?.total || 0);
    const net = round2(totalIncome - totalExpense);

    res.json({
      month,
      label: formatMonthKey(month),
      timezone: TIMEZONE,
      cards: {
        openingBalance: opening.amount,
        totalIncome,
        totalExpense,
        netBalance: net,
        closingBalance: round2(opening.amount + net),
        pendingBills: round2(pendingAgg[0]?.total || 0),
        pendingCount: pendingAgg[0]?.count || 0,
        receiptCount: feeAgg[0]?.count || 0,
      },
      income: { fees: round2(feeIncome), other: round2(otherIncome) },
      categoryBreakdown: byCategory.map(c => ({
        category: c._id || 'Uncategorised',
        total: round2(c.total),
        count: c.count,
        share: totalExpense > 0 ? Math.round((c.total / totalExpense) * 100) : 0,
      })),
      isClosed: Boolean(closed?.isClosed),
      closedAt: closed?.closedAt || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Close a month, snapshotting its totals
// @route   POST /api/accounts/close-month
const closeMonth = async (req, res) => {
  try {
    const { currentCampus } = req;
    if (!currentCampus) return res.status(400).json({ message: 'An active campus is required' });

    const { month, notes } = req.body;
    const range = monthRange(month);
    if (!range) return res.status(400).json({ message: 'Month must look like 2026-08' });

    // A month still running would be closed on partial figures.
    if (month >= currentMonthKey()) {
      return res.status(400).json({
        message: `${formatMonthKey(month)} has not finished yet. A month can only be closed once it is over.`,
      });
    }

    const existing = await ClosedMonth.findOne({ campus: currentCampus, month });
    if (existing?.isClosed) {
      return res.status(400).json({ message: `${formatMonthKey(month)} is already closed.` });
    }

    // Closing out of order would build a chain on an opening balance that has not
    // been settled yet.
    const prev = previousMonth(month);
    const prevHasActivity = await Expense.countDocuments({
      campus: currentCampus, isDeleted: false,
      date: { $lt: range.start },
    });
    if (prevHasActivity > 0) {
      const prevClosed = await ClosedMonth.findOne({ campus: currentCampus, month: prev, isClosed: true }).lean();
      const anyClosed = await ClosedMonth.countDocuments({ campus: currentCampus, isClosed: true });
      if (!prevClosed && anyClosed > 0) {
        return res.status(400).json({
          message: `${formatMonthKey(prev)} is still open. Months must be closed in order so each opening balance follows the last.`,
        });
      }
    }

    const campusId = oid(currentCampus);
    const dateRange = { $gte: range.start, $lt: range.end };

    const [feeAgg, expenseAgg, pendingAgg, salaryAgg, opening] = await Promise.all([
      FeePayment.aggregate([
        { $match: { campus: campusId, isDeleted: false, receivedOn: dateRange } },
        {
          $lookup: {
            from: 'feerecords',
            localField: 'feeRecord',
            foreignField: '_id',
            as: 'feeRecordDoc'
          }
        },
        { $unwind: { path: '$feeRecordDoc', preserveNullAndEmptyArrays: true } },
        { $match: { 'feeRecordDoc.isOpeningBalance': { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { campus: campusId, isDeleted: false, date: dateRange, ...Expense.APPROVED_MATCH } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { campus: campusId, isDeleted: false, date: dateRange, status: 'Pending' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { campus: campusId, isDeleted: false, date: dateRange, category: 'Salary', ...Expense.APPROVED_MATCH } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      openingBalanceFor(currentCampus, month),
    ]);

    const feeIncome = round2(feeAgg[0]?.total || 0);
    const otherIncome = round2(expenseAgg.find(e => e._id === 'Income')?.total || 0);
    const totalExpense = round2(expenseAgg.find(e => e._id === 'Expense')?.total || 0);
    const salaryExpense = round2(salaryAgg[0]?.total || 0);
    const totalIncome = round2(feeIncome + otherIncome);
    const netBalance = round2(opening.amount + totalIncome - totalExpense);

    const snapshot = {
      campus: currentCampus,
      month,
      openingBalance: opening.amount,
      totalIncome,
      totalExpense,
      netBalance,
      breakdown: {
        feeIncome,
        otherIncome,
        salaryExpense,
        otherExpense: round2(totalExpense - salaryExpense),
        pendingExcluded: round2(pendingAgg[0]?.total || 0),
      },
      closedBy: req.user?._id,
      closedAt: new Date(),
      notes,
      isClosed: true,
    };

    const saved = await ClosedMonth.findOneAndUpdate(
      { campus: currentCampus, month },
      { $set: snapshot },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      message: `${formatMonthKey(month)} closed. Closing balance Rs. ${netBalance.toLocaleString()}.`,
      closedMonth: saved,
      pendingExcluded: pendingAgg[0]?.count || 0,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'That month is already closed.' });
    }
    res.status(500).json({ message: err.message });
  }
};

// @desc    Reopen a closed month
// @route   POST /api/accounts/reopen-month
const reopenMonth = async (req, res) => {
  try {
    const { currentCampus } = req;
    const { month, reason } = req.body;

    const record = await ClosedMonth.findOne({ campus: currentCampus, month, isClosed: true });
    if (!record) return res.status(404).json({ message: `${formatMonthKey(month)} is not closed.` });

    // Reopening a month invalidates the opening balance of every month after it,
    // so a later closed month has to be reopened first.
    const laterClosed = await ClosedMonth.findOne({
      campus: currentCampus, month: { $gt: month }, isClosed: true,
    }).sort({ month: 1 }).lean();

    if (laterClosed) {
      return res.status(400).json({
        message: `${formatMonthKey(laterClosed.month)} was closed after this one and carries its balance forward. Reopen that month first.`,
      });
    }

    record.isClosed = false;
    record.isReopened = true;
    record.reopenedBy = req.user?._id;
    record.reopenedAt = new Date();
    record.reopenReason = reason;
    await record.save();

    res.json({ message: `${formatMonthKey(month)} reopened. Its records can be edited again.`, closedMonth: record });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    List closed months (for greying out pickers)
// @route   GET /api/accounts/closed-months
const getClosedMonths = async (req, res) => {
  try {
    const rows = await ClosedMonth.find({ campus: req.currentCampus })
      .populate('closedBy', 'name')
      .sort({ month: -1 })
      .lean();
    res.json(rows.map(r => ({ ...r, label: formatMonthKey(r.month) })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getLedger,
  getLedgerRows,
  getSummary,
  closeMonth,
  reopenMonth,
  getClosedMonths,
  openingBalanceFor,
};
