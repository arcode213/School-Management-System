const mongoose = require('mongoose');
const { MONTH_KEY_RE } = require('../utils/ledgerMonth');

/**
 * A bill that arrives every month — rent, internet, a cleaning contract.
 *
 * The template does not itself cost anything. Once per ledger month it produces
 * a real `Expense` row with `status: 'Pending'`, which the admin confirms once
 * the bill is actually paid. Nothing is ever paid automatically; the point is to
 * stop a fixed cost being forgotten, not to guess that it was settled.
 *
 * SCOPE: campus, not academic session.
 * Rent does not stop at the end of a school year, and a template pinned to a
 * session would go quiet at rollover — exactly when nobody is watching for it.
 * Generated rows still carry a session, resolved from whichever one is active at
 * the moment they are produced.
 *
 * IDEMPOTENCE lives on the generated `Expense`, not here: a unique index on
 * (recurringSource, recurringMonth) means a duplicate run fails at the database
 * rather than relying on `lastGeneratedMonth` being accurate. That field is a
 * fast skip, not the guarantee.
 */
const recurringExpenseSchema = new mongoose.Schema(
  {
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },

    title: { type: String, required: [true, 'Please give the recurring bill a title'], trim: true },

    categoryRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: [true, 'Please choose a category'],
    },
    subCategory: { type: String, trim: true },

    amount: {
      type: Number,
      required: [true, 'Please specify the expected amount'],
      min: [0, 'Amount cannot be negative'],
    },

    paymentMethod: { type: String, enum: ['Cash', 'Bank', 'Cheque', 'Online'], default: 'Bank' },
    paidTo: { type: String, trim: true },
    description: { type: String, trim: true },

    /**
     * Which day of the month the generated expense is dated.
     *
     * Capped at 28 on purpose: a bill set to the 30th would silently shift in
     * February, and a ledger row landing in the wrong month is worse than one
     * landing two days early.
     */
    dayOfMonth: { type: Number, min: 1, max: 28, default: 1 },

    // 'YYYY-MM'. Generation never runs before `startMonth`, nor after `endMonth`
    // when one is set — so a twelve-month contract stops on its own.
    startMonth: {
      type: String,
      required: true,
      match: [MONTH_KEY_RE, 'startMonth must look like 2026-08'],
    },
    endMonth: {
      type: String,
      default: null,
      match: [MONTH_KEY_RE, 'endMonth must look like 2026-08'],
    },

    isActive: { type: Boolean, default: true },

    // The last month a row was produced for. A fast skip on the common path.
    lastGeneratedMonth: { type: String, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// The generator's query: every live template for a campus.
recurringExpenseSchema.index({ campus: 1, isActive: 1, isDeleted: 1 });

module.exports = mongoose.model('RecurringExpense', recurringExpenseSchema);
