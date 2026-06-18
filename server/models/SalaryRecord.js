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
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: { type: String, enum: ['Cash', 'Bank Transfer', 'Cheque'], default: 'Bank Transfer' },
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Paid' },
    remarks: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-calculate netSalary before save
salaryRecordSchema.pre('save', function (next) {
  this.netSalary = this.baseSalary + this.allowances - this.deductions;
  next();
});

salaryRecordSchema.index({ employee: 1, salaryMonth: 1, salaryYear: 1 }, { unique: true });

module.exports = mongoose.model('SalaryRecord', salaryRecordSchema);
