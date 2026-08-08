const mongoose = require('mongoose');

const salaryRecordSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    salaryMonth: {
      type: String,
      enum: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      required: true,
    },
    salaryYear: { type: Number, required: true },
    baseSalary: { type: Number, required: true },
    allowances: { type: Number, default: 0 },

    // The authoritative total deduction. The pre-save hook below has always
    // computed netSalary from this and still does — the itemised fields added for
    // the accounts module are summed INTO it by the controller, never instead of
    // it, so an existing record's net pay cannot shift.
    deductions: { type: Number, default: 0 },

    netSalary: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: ['Cash', 'Bank Transfer', 'Cheque'], default: 'Bank Transfer' },

    // 'Partial' added for part-payments. 'Paid' remains the default, which is
    // right for every record written by the older salary screen.
    status: { type: String, enum: ['Paid', 'Partial', 'Pending'], default: 'Paid' },
    remarks: { type: String },
    isDeleted: { type: Boolean, default: false },

    // ─── Accounts module ─────────────────────────────────────────────────────
    // Additive. Nothing below is required.

    /**
     * How much of `netSalary` has actually been handed over.
     *
     * DELIBERATELY NO DEFAULT. Mongoose applies defaults when hydrating documents
     * from the database, so `default: 0` would be a claim about every salary ever
     * posted — and every one of them is status 'Paid'. The salary sheet would show
     * historical staff as unpaid and invite a second payment. Left undefined,
     * legacy records fall through to `paidAmount()` below, which reads them as
     * what they are: paid in full.
     */
    amountPaid: { type: Number },

    // Each disbursement, so a part-paid salary records when each instalment went.
    payments: [{
      amount: { type: Number, required: true },
      date: { type: Date, required: true },
      method: { type: String, enum: ['Cash', 'Bank Transfer', 'Cheque'], default: 'Bank Transfer' },
      recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      remarks: { type: String },
    }],

    // Itemised breakdown of `deductions`, for the salary slip. Informational: the
    // controller keeps their sum equal to `deductions`.
    advanceDeduction: { type: Number, default: 0 },
    absenceDeduction: { type: Number, default: 0 },
    taxDeduction: { type: Number, default: 0 },
    otherDeduction: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },

    // Advances this sheet clawed back, so a reversal knows what to give back.
    recoveredAdvances: [{
      advance: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryAdvance' },
      amount: { type: Number },
    }],

    // The cash-outflow row this salary posted to the ledger.
    expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

/**
 * What this salary has actually paid out.
 *
 * A record written before `amountPaid` existed has none, and every one of those
 * is status 'Paid' — so it paid its full net salary. Reading the raw field would
 * report nil. Same fallback shape as FeeRecord's monthly/annual balances.
 */
salaryRecordSchema.methods.paidAmount = function () {
  if (this.amountPaid !== undefined && this.amountPaid !== null) return this.amountPaid;
  return this.status === 'Paid' ? (this.netSalary || 0) : 0;
};

/** What is still owed on this salary. */
salaryRecordSchema.methods.outstandingAmount = function () {
  return Math.max(0, (this.netSalary || 0) - this.paidAmount());
};

/**
 * The same fallback as an aggregation expression, for pipelines that cannot call
 * a document method. Keep in step with `paidAmount()` above.
 */
salaryRecordSchema.statics.paidAmountExpr = () => ({
  $ifNull: [
    '$amountPaid',
    { $cond: [{ $eq: ['$status', 'Paid'] }, { $ifNull: ['$netSalary', 0] }, 0] },
  ],
});

// Auto-calculate netSalary before save
salaryRecordSchema.pre('save', function (next) {
  this.netSalary = this.baseSalary + this.allowances - this.deductions;
  next();
});

salaryRecordSchema.index({ employee: 1, salaryMonth: 1, salaryYear: 1 }, { unique: true });

// Building a month's salary sheet, and the ledger's salary-expense total.
salaryRecordSchema.index({ campus: 1, salaryYear: 1, salaryMonth: 1, isDeleted: 1 });
salaryRecordSchema.index({ campus: 1, status: 1, isDeleted: 1 });

module.exports = mongoose.model('SalaryRecord', salaryRecordSchema);
