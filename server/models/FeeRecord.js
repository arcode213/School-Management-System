const mongoose = require('mongoose');

const feeRecordSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    feeMonth: {
      type: String,
      enum: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      required: true,
    },
    feeYear: { type: Number, required: true },
    tuitionFee: { type: Number, default: 0 },
    examFee: { type: Number, default: 0 },
    transportFee: { type: Number, default: 0 },
    otherFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    lateFine: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    paymentDate: { type: Date },
    paymentMethod: { type: String, enum: ['Cash', 'Bank', 'Online'], default: 'Cash' },
    status: { type: String, enum: ['Paid', 'Unpaid', 'Partial'], default: 'Unpaid' },
    receiptNumber: { type: String, unique: true, sparse: true },
    challanIssued: { type: Boolean, default: false },
    remarks: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-calculate totalAmount, balance, and status before saving
feeRecordSchema.pre('save', function (next) {
  this.totalAmount = this.tuitionFee + this.examFee + this.transportFee + this.otherFee + this.lateFine - this.discount;
  this.balance = this.totalAmount - this.amountPaid;
  if (this.amountPaid >= this.totalAmount) this.status = 'Paid';
  else if (this.amountPaid > 0) this.status = 'Partial';
  else this.status = 'Unpaid';

  // Auto-generate receipt number when paid
  if (this.status === 'Paid' && !this.receiptNumber) {
    this.receiptNumber = `RCP-${Date.now()}`;
  }
  next();
});

feeRecordSchema.index({ student: 1, feeMonth: 1, feeYear: 1 });
feeRecordSchema.index({ status: 1, feeYear: 1 });

module.exports = mongoose.model('FeeRecord', feeRecordSchema);
