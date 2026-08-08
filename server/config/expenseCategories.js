/**
 * The categories every campus starts with.
 *
 * These are seeded per campus the first time the accounts screen is opened, not
 * hard-coded into the schema — the admin can rename, deactivate or add to them,
 * which is the whole point of having a collection rather than an enum.
 *
 * `legacyKey` is what makes the existing data keep working. `Expense.category`
 * used to be a string enum, and there are live records carrying those values. A
 * seeded category claims its old enum value here, so an expense written before
 * this module existed resolves to the right category without its document ever
 * being rewritten. Every value of the old enum is claimed by exactly one
 * category below — including `Food`, `Tuition`, `Donation` and `Grant`, which are
 * not in the default list the school asked for but do exist in the data.
 *
 * `suggested` are sub-category hints offered in the entry form. They are not
 * validated against — sub-category is free text, so a school can type whatever
 * its bills actually say.
 */

const DEFAULT_EXPENSE_CATEGORIES = [
  {
    name: 'Salaries',
    legacyKey: 'Salary',
    suggested: ['Teaching Staff', 'Admin Staff', 'Support Staff', 'Bonus'],
    // Salary payments post their own expense rows from the salary sheet, so this
    // category is normally filled automatically rather than by hand.
    isSystem: true,
  },
  {
    name: 'Utility Bills',
    legacyKey: 'Utilities',
    suggested: ['Electricity', 'Gas', 'Water', 'Internet', 'Telephone'],
  },
  {
    name: 'Rent',
    legacyKey: 'Rent',
    suggested: ['Building Rent', 'Ground Rent'],
  },
  {
    name: 'Maintenance & Repairs',
    legacyKey: 'Maintenance',
    suggested: ['Building', 'Furniture', 'Electrical', 'Plumbing', 'IT Equipment'],
  },
  {
    name: 'Stationery & Supplies',
    legacyKey: 'Stationery',
    suggested: ['Office Stationery', 'Exam Papers', 'Printing', 'Cleaning Supplies'],
  },
  {
    name: 'Transport & Fuel',
    suggested: ['Fuel', 'Van Maintenance', 'Driver Wages'],
  },
  {
    name: 'Events',
    suggested: ['Sports Day', 'Annual Function', 'Trips', 'Prize Distribution'],
  },
  {
    name: 'Food & Refreshments',
    legacyKey: 'Food',
    suggested: ['Staff Refreshments', 'Event Catering'],
  },
  {
    name: 'Miscellaneous',
    legacyKey: 'Other',
    suggested: [],
  },
];

/**
 * Income categories exist only so that historical `type: 'Income'` rows written
 * by the older Expenses screen still resolve to a named category. The school
 * records income by taking fee payments, not by entering it here — see
 * models/FeePayment.js.
 */
const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Tuition (manual)', legacyKey: 'Tuition' },
  { name: 'Donation', legacyKey: 'Donation' },
  { name: 'Grant', legacyKey: 'Grant' },
];

const DEFAULT_CATEGORIES = [
  ...DEFAULT_EXPENSE_CATEGORIES.map(c => ({ ...c, type: 'Expense' })),
  ...DEFAULT_INCOME_CATEGORIES.map(c => ({ ...c, type: 'Income' })),
];

// The complete old enum, kept here so a test can assert nothing was dropped.
const LEGACY_CATEGORY_KEYS = [
  'Utilities', 'Maintenance', 'Rent', 'Salary', 'Stationery',
  'Food', 'Tuition', 'Donation', 'Grant', 'Other',
];

module.exports = {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_CATEGORIES,
  LEGACY_CATEGORY_KEYS,
};
