const mongoose = require('mongoose');

/**
 * A configurable expense (or income) category.
 *
 * `Expense.category` used to be a fixed string enum. Live records still carry
 * those values, so this collection does not replace the enum — it sits beside it
 * and `legacyKey` claims the old value, letting an untouched historical expense
 * resolve to a real category. Nothing is migrated; see config/expenseCategories.js.
 *
 * Categories are per campus, matching how every other configurable thing in the
 * system is scoped, so two campuses can keep different chart-of-accounts without
 * one editing the other's.
 */
const expenseCategorySchema = new mongoose.Schema(
  {
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },

    name: { type: String, required: [true, 'Category name is required'], trim: true },

    // Lower-cased `name`, maintained by the pre-validate hook below purely so the
    // uniqueness index can be case-insensitive: "Rent" and "rent" are the same
    // category and letting both exist would split a month's totals in two.
    nameKey: { type: String, required: true, lowercase: true, trim: true },

    type: { type: String, enum: ['Expense', 'Income'], default: 'Expense' },

    // The value of the old `Expense.category` enum this category stands in for.
    // Only set on seeded defaults; a custom category has none.
    legacyKey: { type: String, default: null },

    // Free-text hints offered in the entry form's sub-category field.
    suggested: [{ type: String, trim: true }],

    // Seeded rather than created by the admin. Kept so the UI can explain why a
    // category cannot be deleted outright.
    isDefault: { type: Boolean, default: false },

    // Written to by the system itself (salary postings land in "Salaries"), so
    // deactivating it would strand automatic rows. The UI warns rather than blocks.
    isSystem: { type: Boolean, default: false },

    // Deactivating hides a category from new entries while leaving every existing
    // expense that used it intact and still reportable. This is the intended way
    // to retire a category — deletion is only for one created by mistake.
    isActive: { type: Boolean, default: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

expenseCategorySchema.pre('validate', function (next) {
  if (this.name) this.nameKey = this.name.trim().toLowerCase();
  next();
});

// One category per name per campus. Partial, so soft-deleting a category frees
// its name for reuse rather than blocking it forever.
expenseCategorySchema.index(
  { campus: 1, nameKey: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

// Resolving a legacy `Expense.category` string to its category.
expenseCategorySchema.index({ campus: 1, legacyKey: 1 });

// The picker: active categories of a type, for a campus.
expenseCategorySchema.index({ campus: 1, type: 1, isActive: 1, isDeleted: 1 });

module.exports = mongoose.model('ExpenseCategory', expenseCategorySchema);
