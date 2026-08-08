const mongoose = require('mongoose');

/**
 * A single receipt: money that actually arrived, on the day it arrived.
 *
 * WHY THIS EXISTS
 * `FeeRecord` records what a challan is worth and how much of it has been settled
 * — `amountPaid` is a running total and `paymentDate` is only the most recent
 * payment. That is enough to answer "what does this student still owe", which is
 * all the fee screens ever asked. It cannot answer "how much cash came in during
 * September", because a challan that was part-paid in August and cleared in
 * October carries one date and one number.
 *
 * The accounts ledger is built on cash: Opening Balance → Income → Expenses → Net
 * Balance, carried forward. Income has to be the money received in the month, or
 * a closed month's total changes retroactively the moment an old challan is paid,
 * and the carried-forward balance stops reconciling. So each payment is written
 * here as its own dated row, and the ledger sums these rather than the challans.
 *
 * The school's income is entirely automatic: paying a challan is what creates
 * income, and nothing else needs to be entered by hand.
 *
 * RELATIONSHIP TO FeeRecord
 * This collection never replaces or contradicts the challan — it is written in
 * the same transaction as the challan update, so the receipts for a challan
 * always sum to its `amountPaid`. `FeeRecord` stays the authority on what is
 * owed; this is the authority on when money moved.
 *
 * ADJUSTMENTS
 * A cashier correcting an over-entered amount lowers the challan's running total.
 * That is recorded here as a NEGATIVE row rather than by editing or deleting the
 * original receipt: financial history is appended to, never rewritten, and the
 * sum still matches the challan.
 */
const feePaymentSchema = new mongoose.Schema(
  {
    feeRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeRecord', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },

    // Scope is copied from the challan rather than read from the request, so a
    // receipt can never land in a different campus or session than the challan it
    // settles.
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },

    // Net movement on the challan's running total. Positive for a payment,
    // negative for a correction.
    amount: { type: Number, required: true },

    // How this receipt was split across the challan's two buckets, mirroring the
    // allocation the cashier chose on the payment screen. Kept so a monthly
    // collection report can separate recurring fee income from annual fee income
    // without re-deriving it from the challan.
    monthlyPortion: { type: Number, default: 0 },
    annualPortion: { type: Number, default: 0 },

    // Discount granted at the same time. Recorded for the audit trail only — a
    // discount is money never received, so it is NOT income and is deliberately
    // excluded from `amount`.
    discountApplied: { type: Number, default: 0 },

    method: {
      type: String,
      enum: ['Cash', 'Bank', 'Online', 'Cheque'],
      default: 'Cash',
    },

    // The date the money changed hands — the field the whole ledger groups by.
    receivedOn: { type: Date, required: true },

    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    remarks: { type: String, trim: true },

    // True for the single synthetic row written per historical challan by
    // scripts/backfillFeePayments.js. Those rows are dated from the challan's last
    // `paymentDate`, so for a challan paid in instalments before this collection
    // existed the whole amount sits on one date. Flagged so a report can say so
    // rather than implying a precision the data does not have.
    isBackfill: { type: Boolean, default: false },

    // True for a negative correction row (see ADJUSTMENTS above).
    isAdjustment: { type: Boolean, default: false },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// The ledger's hot path: every monthly total is a match on campus + session +
// a date range over `receivedOn`.
feePaymentSchema.index({ campus: 1, academicSession: 1, receivedOn: 1, isDeleted: 1 });

// Reading a single challan's receipt history, and the backfill's "does this
// challan already have receipts" check.
feePaymentSchema.index({ feeRecord: 1, isDeleted: 1 });

feePaymentSchema.index({ student: 1, receivedOn: -1 });

module.exports = mongoose.model('FeePayment', feePaymentSchema);
