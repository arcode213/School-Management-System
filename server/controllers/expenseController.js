const Expense = require('../models/Expense');

// @desc    Get all expenses (filtered by campus/session context)
// @route   GET /api/expenses
const getExpenses = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const { search, category, page = 1, limit = 10 } = req.query;

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

    res.json({
      expenses,
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

// @desc    Create a new expense
// @route   POST /api/expenses
const createExpense = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const { title, category, amount, date, description } = req.body;

    if (!currentCampus || !currentSession) {
      return res.status(400).json({ message: 'Active campus and academic session context are required' });
    }

    const expense = new Expense({
      campus: currentCampus,
      academicSession: currentSession,
      title,
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

// @desc    Update an expense record
// @route   PUT /api/expenses/:id
const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, amount, date, description } = req.body;

    const expense = await Expense.findOne({ _id: id, isDeleted: false });

    if (!expense) {
      return res.status(404).json({ message: 'Expense record not found' });
    }

    // Verify campus context matches (for non-admins)
    if (req.user.role !== 'Admin' && expense.campus.toString() !== req.currentCampus.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this expense' });
    }

    expense.title = title || expense.title;
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

// @desc    Delete (soft-delete) an expense record
// @route   DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findOne({ _id: id, isDeleted: false });

    if (!expense) {
      return res.status(404).json({ message: 'Expense record not found' });
    }

    // Verify campus context
    if (req.user.role !== 'Admin' && expense.campus.toString() !== req.currentCampus.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this expense' });
    }

    expense.isDeleted = true;
    await expense.save();

    res.json({ message: 'Expense record deleted successfully' });
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
