const mongoose = require('mongoose');

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
    
    // Previous Dues rolled into this challan
    previousDues: { type: Number, default: 0 },
    
    // Total Amount (Current charges + previousDues)
    totalAmount: { type: Number, default: 0 },
    
    // Payment Tracking
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    
    paymentDate: { type: Date },
    paymentMethod: { type: String, enum: ['Cash', 'Bank', 'Online'], default: 'Cash' },
    status: { type: String, enum: ['Paid', 'Unpaid', 'Partial', 'Overdue'], default: 'Unpaid' },
    
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    
    // Flag to indicate if this challan's unpaid balance has been rolled over to a NEWER challan.
    hasBeenCarriedForward: { type: Boolean, default: false },
    
    remarks: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-calculate totalAmount, balance, and status before saving
feeRecordSchema.pre('save', function (next) {
  this.totalAmount = this.tuitionFee + this.examFee + this.transportFee + this.miscFee + this.lateFine - this.discount + this.previousDues;
  this.balance = this.totalAmount - this.amountPaid;
  
  if (this.amountPaid >= this.totalAmount && this.totalAmount > 0) {
    this.status = 'Paid';
  } else if (this.amountPaid > 0) {
    this.status = 'Partial';
  } else if (this.dueDate && new Date() > this.dueDate && this.amountPaid === 0) {
    this.status = 'Overdue';
  } else {
    this.status = 'Unpaid';
  }
  
  next();
});

feeRecordSchema.index({ student: 1, feeMonth: 1, feeYear: 1 });
feeRecordSchema.index({ status: 1, feeYear: 1 });
feeRecordSchema.index({ campus: 1, academicSession: 1 });

module.exports = mongoose.model('FeeRecord', feeRecordSchema);
