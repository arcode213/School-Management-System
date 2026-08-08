const mongoose = require('mongoose');
const { MONTH_KEY_RE } = require('../utils/ledgerMonth');

/**
 * A finalised month. Once closed, nothing dated inside it may be written.
 *
 * WHY THE TOTALS ARE STORED
 * The closing figures are a snapshot, not a live query. Next month's opening
 * balance reads `netBalance` from here, so the running balance is a chain of
 * recorded facts rather than a sum re-derived over all history every time the
 * page loads. It also means the books say what they said on closing day: if a
 * correction is later made in an open month, last month's closed total does not
 * quietly change underneath it.
 *
 * SCOPE: campus + calendar month, deliberately not academic session.
 * Rent, salaries and utility bills are monthly obligations that do not pause at
 * a session boundary, and a session spans two calendar years — so closing "the
 * month" is the only unit that means the same thing to an accountant and to the
 * school.
 *
 * REOPENING is allowed but recorded. A month that has been reopened keeps
 * `isReopened` for good, because the figures other months were carried forward
 * from may no longer be the ones on file.
 */
const closedMonthSchema = new mongoose.Schema(
  {
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },

    month: {
      type: String,
      required: true,
      match: [MONTH_KEY_RE, 'month must look like 2026-08'],
    },

    // ── Snapshot taken at the moment of closing ──────────────────────────────
    // Carried from the previous closed month, so the chain is explicit.
    openingBalance: { type: Number, default: 0 },
    // Fee receipts in the month, plus any manually entered income rows.
    totalIncome: { type: Number, default: 0 },
    // Approved expenses in the month. Pending ones are excluded — an unconfirmed
    // bill is not money that has left.
    totalExpense: { type: Number, default: 0 },
    // openingBalance + totalIncome − totalExpense. Next month's opening balance.
    netBalance: { type: Number, default: 0 },

    // Kept for the closing report so the figure can be explained without re-running
    // the aggregation.
    breakdown: {
      feeIncome: { type: Number, default: 0 },
      otherIncome: { type: Number, default: 0 },
      salaryExpense: { type: Number, default: 0 },
      otherExpense: { type: Number, default: 0 },
      pendingExcluded: { type: Number, default: 0 },
    },

    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date, default: Date.now },

    notes: { type: String, trim: true },

    // ── Reopening ────────────────────────────────────────────────────────────
    // `isClosed` is what the write-lock actually tests. Reopening flips it back to
    // false but keeps the row, so the history of the close survives.
    isClosed: { type: Boolean, default: true },
    isReopened: { type: Boolean, default: false },
    reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reopenedAt: { type: Date },
    reopenReason: { type: String, trim: true },
  },
  { timestamps: true }
);

// One closing per month per campus. Not partial — a month has exactly one record
// whether it is currently closed or has been reopened.
closedMonthSchema.index({ campus: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('ClosedMonth', closedMonthSchema);
