const ExpenseCategory = require('../models/ExpenseCategory');
const Expense = require('../models/Expense');
const RecurringExpense = require('../models/RecurringExpense');
const { seedExpenseCategories } = require('../utils/seedExpenseCategories');

// @desc    List categories for the active campus (seeding the defaults if new)
// @route   GET /api/expense-categories
const getCategories = async (req, res) => {
  try {
    const { currentCampus } = req;
    if (!currentCampus) {
      return res.status(400).json({ message: 'An active campus is required' });
    }

    // A campus that has never opened this screen gets its defaults here.
    await seedExpenseCategories(currentCampus, req.user?._id);

    const { type, includeInactive } = req.query;
    const query = { campus: currentCampus, isDeleted: false };
    if (type) query.type = type;
    if (includeInactive !== 'true') query.isActive = true;

    const categories = await ExpenseCategory.find(query)
      .sort({ type: 1, name: 1 })
      .lean();

    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create a category
// @route   POST /api/expense-categories
const createCategory = async (req, res) => {
  try {
    const { currentCampus } = req;
    if (!currentCampus) {
      return res.status(400).json({ message: 'An active campus is required' });
    }

    const category = await ExpenseCategory.create({
      campus: currentCampus,
      name: req.body.name,
      type: req.body.type || 'Expense',
      suggested: req.body.suggested || [],
      isDefault: false,
      isActive: true,
      createdBy: req.user?._id,
    });

    res.status(201).json(category);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A category with that name already exists at this campus' });
    }
    res.status(400).json({ message: err.message });
  }
};

// @desc    Update a category
// @route   PUT /api/expense-categories/:id
const updateCategory = async (req, res) => {
  try {
    const category = await ExpenseCategory.findOne({
      _id: req.params.id,
      campus: req.currentCampus,
      isDeleted: false,
    });
    if (!category) return res.status(404).json({ message: 'Category not found' });

    if (req.body.name !== undefined) category.name = req.body.name;
    if (req.body.suggested !== undefined) category.suggested = req.body.suggested;
    if (req.body.isActive !== undefined) category.isActive = req.body.isActive;

    // `type` is deliberately not editable. Flipping a category from Expense to
    // Income would silently move every historical row that used it from one side
    // of the ledger to the other, changing months that may already be closed.
    category.updatedBy = req.user?._id;

    await category.save();
    res.json(category);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'A category with that name already exists at this campus' });
    }
    res.status(400).json({ message: err.message });
  }
};

// @desc    Soft-delete a category (only if nothing has ever used it)
// @route   DELETE /api/expense-categories/:id
const deleteCategory = async (req, res) => {
  try {
    const category = await ExpenseCategory.findOne({
      _id: req.params.id,
      campus: req.currentCampus,
      isDeleted: false,
    });
    if (!category) return res.status(404).json({ message: 'Category not found' });

    // Deleting a category that has expenses against it would orphan them and make
    // last month's breakdown unexplainable. Deactivating is the intended way to
    // retire one: it disappears from the entry form and stays in the reports.
    const [usedByExpense, usedByRecurring] = await Promise.all([
      Expense.countDocuments({ categoryRef: category._id, isDeleted: false }),
      RecurringExpense.countDocuments({ categoryRef: category._id, isDeleted: false }),
    ]);

    if (usedByExpense > 0 || usedByRecurring > 0) {
      const parts = [];
      if (usedByExpense > 0) parts.push(`${usedByExpense} expense${usedByExpense > 1 ? 's' : ''}`);
      if (usedByRecurring > 0) parts.push(`${usedByRecurring} recurring bill${usedByRecurring > 1 ? 's' : ''}`);
      return res.status(400).json({
        message: `"${category.name}" is used by ${parts.join(' and ')}, so it cannot be deleted. Turn it off instead — it will stop appearing on new entries but stay in your reports.`,
      });
    }

    if (category.isSystem) {
      return res.status(400).json({
        message: `"${category.name}" is filled automatically by the system and cannot be deleted.`,
      });
    }

    category.isDeleted = true;
    category.isActive = false;
    category.updatedBy = req.user?._id;
    await category.save();

    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
