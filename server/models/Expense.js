const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  campus: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campus',
    required: true
  },
  academicSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicSession',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please provide a transaction title'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Please specify transaction type'],
    enum: ['Income', 'Expense'],
    default: 'Expense'
  },
  // The original fixed category. Kept, still required, still the same enum — every
  // existing record carries one and nothing rewrites them. New entries set it to
  // the `legacyKey` of the chosen category (or 'Other'), so this field stays a
  // usable fallback and the older Expenses screen keeps working unchanged.
  category: {
    type: String,
    required: [true, 'Please select a category'],
    enum: ['Utilities', 'Maintenance', 'Rent', 'Salary', 'Stationery', 'Food', 'Tuition', 'Donation', 'Grant', 'Other'],
    default: 'Other'
  },

  // ─── Accounts module ───────────────────────────────────────────────────────
  // Everything below is additive. None of it is required and none of it carries a
  // default that would make an existing record read as something it is not —
  // Mongoose applies defaults when hydrating from the database too, so a default
  // here is a claim about every historical row, not just new ones.

  // The configurable category. Absent on every record written before this module,
  // which is why `category` above is still the required one; the controller
  // resolves this from `legacyKey` on read.
  categoryRef: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseCategory' },

  subCategory: { type: String, trim: true },

  // Deliberately no default: a record written before this field existed has no
  // recorded payment method, and defaulting it to 'Cash' would invent one.
  paymentMethod: { type: String, enum: ['Cash', 'Bank', 'Cheque', 'Online'] },

  // Who the money went to — a vendor name, or a staff member for a salary row.
  paidTo: { type: String, trim: true },
  paidToEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },

  // Approval workflow. 'Approved' is the default precisely BECAUSE it applies on
  // hydration: every expense recorded before this existed was a real, settled
  // expense and must keep counting towards its month. Only rows generated from a
  // recurring template are created as 'Pending', which is what the admin confirms.
  //
  // Only Approved rows count towards a month's totals.
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Approved'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  rejectionReason: { type: String, trim: true },

  // Set when this row was generated from a recurring template. The pair is
  // uniquely indexed below, which is what makes generation safe to re-run.
  recurringSource: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringExpense' },
  recurringMonth: { type: String },

  // Set when this row was posted automatically by a salary payment, so the ledger
  // can trace it back and the row is not editable as an ordinary expense.
  salaryRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryRecord' },

  // `recordedBy` above is this document's creator and is left alone. This records
  // the last person to change it.
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: {
    type: Number,
    required: [true, 'Please specify the transaction amount'],
    min: [0, 'Transaction amount cannot be negative']
  },
  date: {
    type: Date,
    required: [true, 'Please select the date'],
    default: Date.now
  },
  description: {
    type: String,
    trim: true
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

/**
 * The match every total must use to mean "this money has actually left".
 *
 * READ THIS BEFORE WRITING `status: 'Approved'` IN A PIPELINE.
 * The `status` field defaults to 'Approved', but a Mongoose default is applied
 * when a document is HYDRATED — it is not written into the database. Records
 * created before this module existed therefore have no `status` field at all, and
 * `{ status: 'Approved' }` would match none of them, silently reporting the
 * school's entire expense history as zero.
 *
 * `$nin` is the fix: in MongoDB a missing field satisfies `$nin`, so this matches
 * both an explicitly approved row and a legacy row that never had the field,
 * while still excluding anything pending or rejected.
 */
expenseSchema.statics.APPROVED_MATCH = { status: { $nin: ['Pending', 'Rejected'] } };

// The ledger's hot path: a month's rows for a campus and session, by date.
expenseSchema.index({ campus: 1, academicSession: 1, date: 1, isDeleted: 1 });

// Category-wise breakdown, and the "is this category still in use" check before
// letting one be deleted.
expenseSchema.index({ categoryRef: 1, isDeleted: 1 });

// Pending-approval queues and the dashboard's "Pending Bills" card.
expenseSchema.index({ campus: 1, status: 1, isDeleted: 1 });

/**
 * One generated row per template per month — this index IS the idempotency
 * guarantee for recurring expenses. A second generation run for the same month
 * hits a duplicate-key error instead of creating a second rent bill, so the
 * generator can be triggered by a page load, a cron, or both at once.
 *
 * Sparse via the partial filter: ordinary expenses have neither field and must
 * not collide with each other.
 */
expenseSchema.index(
  { recurringSource: 1, recurringMonth: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recurringSource: { $exists: true },
      recurringMonth: { $exists: true },
    },
  }
);

module.exports = mongoose.model('Expense', expenseSchema);
