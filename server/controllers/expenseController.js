const Expense = require('../models/Expense');

// @desc    Get all transactions (filtered by campus/session context)
// @route   GET /api/expenses
const getExpenses = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const { search, category, type, page = 1, limit = 10 } = req.query;

    const query = { isDeleted: false };

    if (currentCampus) {
      query.campus = currentCampus;
    }
    if (currentSession) {
      query.academicSession = currentSession;
    }
    if (category) {
      query.category = category;
    }
    if (type) {
      query.type = type;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const count = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
      .populate('recordedBy', 'name email')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // Calculate totals for current context (income, expense, balance)
    const summaryQuery = { isDeleted: false };
    if (currentCampus) summaryQuery.campus = currentCampus;
    if (currentSession) summaryQuery.academicSession = currentSession;

    const aggregateTotals = await Expense.aggregate([
      { $match: summaryQuery },
      { $group: {
          _id: '$type',
          total: { $sum: '$amount' }
      } }
    ]);

    const incomeTotal = aggregateTotals.find(t => t._id === 'Income')?.total || 0;
    const expenseTotal = aggregateTotals.find(t => t._id === 'Expense')?.total || 0;

    res.json({
      expenses,
      totals: {
        income: incomeTotal,
        expense: expenseTotal,
        balance: incomeTotal - expenseTotal
      },
      pagination: {
        total: count,
        page: Number(page),
        pages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create a new transaction
// @route   POST /api/expenses
const createExpense = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const { title, type, category, amount, date, description } = req.body;

    if (!currentCampus || !currentSession) {
      return res.status(400).json({ message: 'Active campus and academic session context are required' });
    }

    const expense = new Expense({
      campus: currentCampus,
      academicSession: currentSession,
      title,
      type: type || 'Expense',
      category,
      amount,
      date: date || undefined,
      description,
      recordedBy: req.user._id
    });

    const savedExpense = await expense.save();
    res.status(201).json(savedExpense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Update a transaction record
// @route   PUT /api/expenses/:id
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, category, amount, date, description } = req.body;

    const expense = await Expense.findOne({ _id: id, isDeleted: false });

    if (!expense) {
      return res.status(404).json({ message: 'Transaction record not found' });
    }

    if (req.user.role !== 'Admin' && expense.campus.toString() !== req.currentCampus.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this record' });
    }

    expense.title = title || expense.title;
    expense.type = type || expense.type;
    expense.category = category || expense.category;
    expense.amount = amount !== undefined ? amount : expense.amount;
    expense.date = date || expense.date;
    expense.description = description !== undefined ? description : expense.description;

    const updatedExpense = await expense.save();
    res.json(updatedExpense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// @desc    Delete (soft-delete) a transaction record
// @route   DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findOne({ _id: id, isDeleted: false });

    if (!expense) {
      return res.status(404).json({ message: 'Transaction record not found' });
    }

    if (req.user.role !== 'Admin' && expense.campus.toString() !== req.currentCampus.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this record' });
    }

    expense.isDeleted = true;
    await expense.save();

    res.json({ message: 'Transaction record deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense
};
