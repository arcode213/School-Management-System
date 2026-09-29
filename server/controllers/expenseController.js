const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const ExpenseCategory = require('../models/ExpenseCategory');
const { legacyCategoryMap } = require('../utils/seedExpenseCategories');
const { assertMonthsOpen, MonthClosedError } = require('../utils/monthLock');
const { ledgerMonthOf, monthRange } = require('../utils/ledgerMonth');

/**
 * Expense entries.
 *
 * This controller predates the accounts module and the older Expenses screen is
 * still built against it, so the response shape below — `{ expenses, totals,
 * pagination }`, and `totals` covering the whole campus/session rather than the
 * current filter — is deliberately unchanged. The accounts module adds filters
 * and fields on top; it does not repurpose what was already there.
 */

// Rows written before `categoryRef` existed carry only the old `category` string.
// Rather than rewrite them, each row is given a `resolvedCategory` on the way out
// so the UI always has something to render.
const attachResolvedCategory = (rows, legacyMap) =>
  rows.map((row) => {
    if (row.categoryRef && typeof row.categoryRef === 'object') {
      return { ...row, resolvedCategory: row.categoryRef.name };
    }
    return { ...row, resolvedCategory: legacyMap[row.category]?.name || row.category };
  });

// @desc    Get all transactions (filtered by campus/session context)
// @route   GET /api/expenses
const getExpenses = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const {
      search, category, type, page = 1, limit = 10,
      // Accounts-module filters. All optional; omitting them reproduces the
      // original behaviour exactly.
      categoryRef, paymentMethod, status, month, dateFrom, dateTo, paidToEmployee,
      sortBy = 'date', sortDir = 'desc',
    } = req.query;

    const query = { isDeleted: false };

    if (currentCampus) query.campus = currentCampus;
    if (currentSession) query.academicSession = currentSession;
    if (category) query.category = category;
    if (type) query.type = type;
    if (categoryRef && mongoose.isValidObjectId(categoryRef)) query.categoryRef = categoryRef;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (paidToEmployee && mongoose.isValidObjectId(paidToEmployee)) query.paidToEmployee = paidToEmployee;

    if (status === 'Approved') {
      // Legacy rows have no status field — see Expense.APPROVED_MATCH.
      Object.assign(query, Expense.APPROVED_MATCH);
    } else if (status) {
      query.status = status;
    }

    // `month` ('2026-08') is a shorthand for the date range of a Karachi calendar
    // month; an explicit from/to wins if both are sent.
    if (month) {
      const range = monthRange(month);
      if (range) query.date = { $gte: range.start, $lt: range.end };
    }
    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) {
        // An inclusive end date: the user means the whole of that day.
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { paidTo: { $regex: search, $options: 'i' } },
      ];
    }

    const sortField = ['date', 'amount', 'createdAt'].includes(sortBy) ? sortBy : 'date';
    const sort = { [sortField]: sortDir === 'asc' ? 1 : -1 };

    const count = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
      .populate('recordedBy', 'name email')
      .populate('categoryRef', 'name type')
      .populate('paidToEmployee', 'fullName employeeId')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    // Totals for the current context. Deliberately NOT narrowed by the filters
    // above — the older screen shows these as campus/session totals and changing
    // that would change what its cards mean.
    const summaryQuery = { isDeleted: false, ...Expense.APPROVED_MATCH };
    if (currentCampus) summaryQuery.campus = new mongoose.Types.ObjectId(currentCampus);
    if (currentSession) summaryQuery.academicSession = new mongoose.Types.ObjectId(currentSession);
    if (query.date) summaryQuery.date = query.date;

    const aggregateTotals = await Expense.aggregate([
      { $match: summaryQuery },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    const incomeTotal = aggregateTotals.find(t => t._id === 'Income')?.total || 0;
    const expenseTotal = aggregateTotals.find(t => t._id === 'Expense')?.total || 0;

    const legacyMap = currentCampus ? await legacyCategoryMap(currentCampus) : {};

    res.json({
      expenses: attachResolvedCategory(expenses, legacyMap),
      totals: {
        income: incomeTotal,
        expense: expenseTotal,
        balance: incomeTotal - expenseTotal,
      },
      pagination: {
        total: count,
        page: Number(page),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Keeps the legacy `category` enum in step with the chosen category.
 *
 * `category` is still required by the schema and is what the older screen reads,
 * so a new entry fills it from the category's `legacyKey` where it has one and
 * falls back to 'Other'. Nothing has to be migrated for both to stay truthful.
 */
const legacyKeyFor = async (categoryRefId, fallback = 'Other') => {
  if (!categoryRefId) return fallback;
  const cat = await ExpenseCategory.findById(categoryRefId).select('legacyKey').lean();
  return cat?.legacyKey || fallback;
};

// @desc    Create a new transaction
// @route   POST /api/expenses
const createExpense = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const {
      title, type, category, amount, date, description,
      categoryRef, subCategory, paymentMethod, paidTo, paidToEmployee, status,
    } = req.body;

    if (!currentCampus || !currentSession) {
      return res.status(400).json({ message: 'Active campus and academic session context are required' });
    }

    const when = date ? new Date(date) : new Date();
    await assertMonthsOpen(currentCampus, [when]);

    const expense = new Expense({
      campus: currentCampus,
      academicSession: currentSession,
      title,
      type: type || 'Expense',
      // Either path works: the accounts screen sends `categoryRef`, the older one
      // sends the `category` string.
      category: categoryRef ? await legacyKeyFor(categoryRef, category) : (category || 'Other'),
      categoryRef: categoryRef || undefined,
      subCategory,
      amount,
      date: when,
      description,
      paymentMethod,
      paidTo,
      paidToEmployee: paidToEmployee || undefined,
      // A hand-entered expense is a fact, not a proposal, so it is approved on
      // entry. Only recurring bills are raised as Pending for confirmation.
      status: status === 'Pending' ? 'Pending' : 'Approved',
      recordedBy: req.user._id,
    });

    const savedExpense = await expense.save();
    res.status(201).json(savedExpense);
  } catch (err) {
    if (err instanceof MonthClosedError) {
      return res.status(err.statusCode).json({ message: err.message, month: err.monthKey });
    }
    res.status(400).json({ message: err.message });
  }
};

// @desc    Update a transaction record
// @route   PUT /api/expenses/:id
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findOne({ _id: id, isDeleted: false });
    if (!expense) return res.status(404).json({ message: 'Transaction record not found' });

    if (req.user.role !== 'Admin' && expense.campus.toString() !== req.currentCampus?.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this record' });
    }

    // A row posted automatically by a salary payment belongs to that payment.
    // Editing it here would put the ledger and the salary sheet out of step.
    if (expense.salaryRecord) {
      return res.status(400).json({
        message: 'This expense was posted by a salary payment. Edit it from the salary sheet instead.',
      });
    }

    // BOTH dates are checked: the month it currently sits in, and the month it
    // would move to. Either being closed blocks the edit.
    const nextDate = req.body.date ? new Date(req.body.date) : expense.date;
    await assertMonthsOpen(expense.campus, [expense.date, nextDate]);

    const {
      title, type, category, amount, date, description,
      categoryRef, subCategory, paymentMethod, paidTo, paidToEmployee,
    } = req.body;

    if (title !== undefined) expense.title = title;
    if (type !== undefined) expense.type = type;
    if (amount !== undefined) expense.amount = amount;
    if (date !== undefined) expense.date = nextDate;
    if (description !== undefined) expense.description = description;
    if (subCategory !== undefined) expense.subCategory = subCategory;
    if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;
    if (paidTo !== undefined) expense.paidTo = paidTo;
    if (paidToEmployee !== undefined) expense.paidToEmployee = paidToEmployee || undefined;

    if (categoryRef !== undefined) {
      expense.categoryRef = categoryRef || undefined;
      expense.category = await legacyKeyFor(categoryRef, expense.category);
    } else if (category !== undefined) {
      expense.category = category;
    }

    expense.updatedBy = req.user._id;

    const updatedExpense = await expense.save();
    res.json(updatedExpense);
  } catch (err) {
    if (err instanceof MonthClosedError) {
      return res.status(err.statusCode).json({ message: err.message, month: err.monthKey });
    }
    res.status(400).json({ message: err.message });
  }
};

// @desc    Delete (soft-delete) a transaction record
// @route   DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findOne({ _id: id, isDeleted: false });
    if (!expense) return res.status(404).json({ message: 'Transaction record not found' });

    if (req.user.role !== 'Admin' && expense.campus.toString() !== req.currentCampus?.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this record' });
    }

    if (expense.salaryRecord) {
      return res.status(400).json({
        message: 'This expense was posted by a salary payment. Reverse it from the salary sheet instead.',
      });
    }

    await assertMonthsOpen(expense.campus, [expense.date]);

    expense.isDeleted = true;
    expense.updatedBy = req.user._id;
    await expense.save();

    res.json({ message: 'Transaction record deleted successfully' });
  } catch (err) {
    if (err instanceof MonthClosedError) {
      return res.status(err.statusCode).json({ message: err.message, month: err.monthKey });
    }
    res.status(500).json({ message: err.message });
  }
};

// @desc    Approve or reject a pending expense
// @route   PATCH /api/expenses/:id/status
const setExpenseStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    const expense = await Expense.findOne({ _id: req.params.id, isDeleted: false });
    if (!expense) return res.status(404).json({ message: 'Transaction record not found' });

    if (req.user.role !== 'Admin' && expense.campus.toString() !== req.currentCampus?.toString()) {
      return res.status(403).json({ message: 'Not authorized to change this record' });
    }

    // Approving moves money into the month's totals, so the month must be open.
    await assertMonthsOpen(expense.campus, [expense.date]);

    expense.status = status;
    expense.updatedBy = req.user._id;

    if (status === 'Approved') {
      expense.approvedBy = req.user._id;
      expense.approvedAt = new Date();
      expense.rejectionReason = undefined;
    } else if (status === 'Rejected') {
      expense.rejectionReason = rejectionReason;
      expense.approvedBy = undefined;
      expense.approvedAt = undefined;
    }

    await expense.save();
    res.json(expense);
  } catch (err) {
    if (err instanceof MonthClosedError) {
      return res.status(err.statusCode).json({ message: err.message, month: err.monthKey });
    }
    res.status(400).json({ message: err.message });
  }
};

// @desc    Expenses awaiting confirmation (the dashboard's "Pending Bills")
// @route   GET /api/expenses/pending
const getPendingExpenses = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const query = { isDeleted: false, status: 'Pending' };
    if (currentCampus) query.campus = currentCampus;
    if (currentSession) query.academicSession = currentSession;

    const [rows, totals] = await Promise.all([
      Expense.find(query)
        .populate('categoryRef', 'name')
        .populate('recurringSource', 'title')
        .sort({ date: 1 })
        .lean(),
      Expense.aggregate([
        { $match: { ...query, campus: new mongoose.Types.ObjectId(currentCampus) } },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      expenses: rows.map(r => ({ ...r, ledgerMonth: ledgerMonthOf(r.date) })),
      total: totals[0]?.amount || 0,
      count: totals[0]?.count || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  setExpenseStatus,
  getPendingExpenses,
};
