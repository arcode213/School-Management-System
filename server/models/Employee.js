const mongoose = require('mongoose');
const { generateSequentialId } = require('../utils/sequentialId');

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, unique: true },
    fullName: { type: String, required: true, trim: true },
    fatherName: { type: String, trim: true },
    cnic: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    designation: {
      type: String,
      enum: ['Teacher', 'Clerk', 'Peon', 'Guard', 'Principal', 'Admin Staff', 'Other'],
      required: true,
    },
    department: { type: String },
    subject: { type: String },
    joiningDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Active', 'Resigned', 'Terminated'], default: 'Active' },
    salary: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    qualification: { type: String },
    experience: { type: String },
    photo: { type: String },
    documents: [{ type: String }],
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-generate employeeId
employeeSchema.pre('save', async function (next) {
  if (!this.employeeId) {
    this.employeeId = await generateSequentialId(this.constructor, 'employeeId', 'EMP');
  }
  next();
});

employeeSchema.index({ campus: 1, designation: 1, status: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
