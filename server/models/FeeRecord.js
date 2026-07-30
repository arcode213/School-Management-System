const mongoose = require('mongoose');
const { computePaidUpToMonth } = require('../utils/feeMonths');

const feeRecordSchema = new mongoose.Schema(
  {
    challanNo: { type: String, unique: true, required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    studentAcademicRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentAcademicRecord', required: true },
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    
    feeMonth: {
      type: String,
      enum: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      required: true,
    },
    feeYear: { type: Number, required: true },
    
    dueMonthRange: { type: String, required: true }, // e.g. "April-June 2026"
    
    // Current month charges
    tuitionFee: { type: Number, default: 0 },
    examFee: { type: Number, default: 0 },
    transportFee: { type: Number, default: 0 },
    miscFee: { type: Number, default: 0 },
    lateFine: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    // Previous MONTHLY dues rolled into this challan
    previousDues: { type: Number, default: 0 },

    // ─── Annual fee ────────────────────────────────────────────────────────────
    // Tracked as its own bucket, separate from the recurring monthly charges, so
    // the challan can print "Current Annual Fee" and "Previous Annual Fee" as
    // distinct lines and each can carry forward on its own.
    //
    // Annual fee charged ON this challan (opt-in per challan at generation time).
    annualFee: { type: Number, default: 0 },
    // Unpaid annual fee rolled in from earlier challans / an opening balance.
    previousAnnualDues: { type: Number, default: 0 },

    // Total Amount (monthlyTotal + annualTotal)
    totalAmount: { type: Number, default: 0 },

    // Derived bucket subtotals, stored so carry-forward and reports never have to
    // re-derive them. monthly = recurring charges + monthly arrears;
    // annual = this challan's annual fee + annual arrears.
    //
    // DELIBERATELY NO `default` on these four derived fields. Mongoose applies
    // defaults when HYDRATING documents too, so a default of 0 would make every
    // pre-existing challan report monthlyBalance: 0 — and the carry-forward
    // fallback below would then read real arrears as nothing owed, silently wiping
    // outstanding dues. Left undefined, legacy records fall back to `balance`
    // (which is exactly what they were). The pre-save hook always sets them.
    monthlyTotal: { type: Number },
    annualTotal: { type: Number },

    // Payment Tracking
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },

    // Share of `amountPaid` deliberately put against the ANNUAL bucket by the
    // cashier (the payment screen collects the monthly and annual amounts
    // separately). Without this, the default rule below settles months first and
    // a parent could never pay the annual fee while months were still open.
    //
    // A default of 0 is safe here (unlike the derived balances below): a legacy
    // record has no explicit allocation, and 0 reproduces exactly the old
    // monthly-first behaviour.
    annualPaid: { type: Number, default: 0 },

    // Outstanding split per bucket (see the pre-save hook for the allocation rule,
    // and the note above on why these carry no default).
    monthlyBalance: { type: Number },
    annualBalance: { type: Number },
    
    paymentDate: { type: Date },
    paymentMethod: { type: String, enum: ['Cash', 'Bank', 'Online'], default: 'Cash' },
    status: { type: String, enum: ['Paid', 'Unpaid', 'Partial', 'Overdue'], default: 'Unpaid' },

    // Last month fully covered by payments so far (for multi-month challans).
    // The outstanding balance is treated as beginning the month AFTER this, so
    // it carries forward under an accurate range (e.g. paid through May -> the
    // next challan's dues start at June).
    paidUpToMonth: { type: String, default: null },
    
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    
    // Flag to indicate if this challan's unpaid balance has been rolled over to a NEWER challan.
    hasBeenCarriedForward: { type: Boolean, default: false },
    carriedForwardTo: { type: mongoose.Schema.Types.ObjectId, ref: 'FeeRecord' },

    // True for the synthetic "opening arrears" record created when a student is
    // admitted/imported with a pre-existing balance. Such a record states the FULL
    // amount owed for its month range, so the carry-forward logic rolls it over as
    // a flat lump sum and must NOT bill skipped months on top of it (see
    // getPreviousDues) — that would double-charge the same period.
    isOpeningBalance: { type: Boolean, default: false },
    
    remarks: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-calculate the bucket subtotals, balance, and status before saving
feeRecordSchema.pre('save', function (next) {
  // Two independent buckets. The monthly side is the recurring obligation plus
  // whatever monthly arrears rolled in; the annual side is the one-off annual fee
  // plus any annual fee still unpaid from before.
  this.monthlyTotal =
    this.tuitionFee + this.examFee + this.transportFee + this.miscFee +
    this.lateFine - this.discount + this.previousDues;
  this.annualTotal = this.annualFee + this.previousAnnualDues;

  this.totalAmount = this.monthlyTotal + this.annualTotal;
  this.balance = this.totalAmount - this.amountPaid;

  // ALLOCATION RULE
  // 1. Whatever the cashier explicitly put against the annual fee (`annualPaid`)
  //    is honoured first — capped by what the annual bucket actually owes, so a
  //    stale earmark can never swallow money the months are owed.
  // 2. The remainder settles the monthly side, oldest month first.
  // 3. Anything still left over spills onto the annual fee.
  //
  // Steps 2-3 alone are the old behaviour, which is what a record with no
  // earmark (every pre-existing challan) still gets. Keeping annual money out of
  // step 2 is what keeps paidUpToMonth meaningful — an annual fee belongs to no
  // month, so it must never be counted as having settled one.
  const paid = Math.max(this.amountPaid, 0);
  const monthlyDue = Math.max(this.monthlyTotal, 0);
  const annualDue = Math.max(this.annualTotal, 0);

  const earmarked = Math.min(Math.max(this.annualPaid || 0, 0), annualDue, paid);
  const monthlyPaid = Math.min(paid - earmarked, monthlyDue);
  const annualPaid = Math.min(annualDue, earmarked + (paid - earmarked - monthlyPaid));

  // Store the allocation back so the record always states where its money went —
  // the payment screen reads this to show what the annual fee still owes.
  this.annualPaid = annualPaid;
  this.monthlyBalance = Math.max(0, monthlyDue - monthlyPaid);
  this.annualBalance = Math.max(0, annualDue - annualPaid);

  if (this.amountPaid >= this.totalAmount && this.totalAmount > 0) {
    this.status = 'Paid';
  } else if (this.amountPaid > 0) {
    this.status = 'Partial';
  } else if (this.dueDate && new Date() > this.dueDate && this.amountPaid === 0) {
    this.status = 'Overdue';
  } else {
    this.status = 'Unpaid';
  }

  // Derive which months the payment has settled — only from the monthly share.
  this.paidUpToMonth = computePaidUpToMonth(this, monthlyPaid);

  next();
});

feeRecordSchema.index({ student: 1, feeMonth: 1, feeYear: 1 });
feeRecordSchema.index({ status: 1, feeYear: 1 });
feeRecordSchema.index({ campus: 1, academicSession: 1 });

module.exports = mongoose.model('FeeRecord', feeRecordSchema);
