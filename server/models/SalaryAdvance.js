const mongoose = require('mongoose');
const { MONTH_KEY_RE } = require('../utils/ledgerMonth');

/**
 * Money paid to a staff member ahead of their salary, recovered from later sheets.
 *
 * An advance is a real cash outflow on the day it is handed over, so it posts its
 * own expense row then. Recovering it later is NOT a second expense — it is a
 * deduction on the salary sheet that reduces what is paid out that month. Booking
 * both would count the same rupee twice, which is the mistake this model exists
 * to make hard: the advance owns the outflow, the sheet owns the deduction.
 */
const salaryAdvanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },

    amount: {
      type: Number,
      required: [true, 'Please specify the advance amount'],
      min: [0, 'Advance amount cannot be negative'],
    },

    dateGiven: { type: Date, required: true, default: Date.now },

    reason: { type: String, trim: true },

    // How much has been clawed back so far. Only ever moved by a salary payment,
    // inside the same transaction that records the payment.
    amountRecovered: { type: Number, default: 0, min: 0 },

    // The first sheet this may be deducted from. Lets an advance given late in a
    // month be recovered from the month after rather than the one it was given in.
    recoverFromMonth: {
      type: String,
      required: true,
      match: [MONTH_KEY_RE, 'recoverFromMonth must look like 2026-09'],
    },

    /**
     * How much to claw back per month. 0 means "recover the whole outstanding
     * amount on the next sheet" — the common case for a small advance.
     */
    monthlyInstalment: { type: Number, default: 0, min: 0 },

    status: {
      type: String,
      enum: ['Outstanding', 'Recovered', 'Cancelled'],
      default: 'Outstanding',
    },

    // The cash-outflow row posted when the advance was handed over.
    expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

/** What is still owed on this advance. */
salaryAdvanceSchema.virtual('outstanding').get(function () {
  return Math.max(0, (this.amount || 0) - (this.amountRecovered || 0));
});

/** What this advance should take off a given month's sheet. */
salaryAdvanceSchema.methods.instalmentFor = function (monthKey) {
  if (this.status !== 'Outstanding') return 0;
  if (!monthKey || monthKey < this.recoverFromMonth) return 0;
  const left = Math.max(0, (this.amount || 0) - (this.amountRecovered || 0));
  if (left === 0) return 0;
  // A zero instalment means recover it all; otherwise never take more than is left.
  return this.monthlyInstalment > 0 ? Math.min(this.monthlyInstalment, left) : left;
};

salaryAdvanceSchema.set('toJSON', { virtuals: true });
salaryAdvanceSchema.set('toObject', { virtuals: true });

// Building a month's sheet: outstanding advances for the staff of a campus.
salaryAdvanceSchema.index({ campus: 1, status: 1, isDeleted: 1 });
salaryAdvanceSchema.index({ employee: 1, status: 1, isDeleted: 1 });

module.exports = mongoose.model('SalaryAdvance', salaryAdvanceSchema);
