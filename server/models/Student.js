const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, unique: true },
    fullName: { type: String, trim: true },
    fatherName: { type: String, trim: true },
    motherName: { type: String, trim: true },
    cast: { type: String, trim: true },
    placeOfBirth: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    religion: { type: String },
    nationality: { type: String, trim: true },
    motherTongue: { type: String, trim: true },
    fatherOccupation: { type: String, trim: true },
    cnic: { type: String, trim: true }, // Student CNIC / B-Form
    fatherCnic: { type: String, trim: true },
    class: { type: String },
    section: { type: String },
    rollNumber: { type: String },
    admissionDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Active', 'Left', 'Graduated'], default: 'Active' },
    address: { type: String },
    phone: { type: String },
    fatherContact: { type: String, trim: true },
    motherContact: { type: String, trim: true },
    emergencyContact: { type: String },
    lastSchool: { type: String, trim: true },
    email: { type: String },
    photo: { type: String },
    campus: { type: String, enum: ['Main-Campus', 'Al-Hussain Campus'], required: true, default: 'Main-Campus' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-generate studentId before saving
studentSchema.pre('save', async function (next) {
  if (!this.studentId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Student').countDocuments();
    this.studentId = `SMS-${year}-${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Indexes for performance
studentSchema.index({ campus: 1, class: 1, section: 1, status: 1 });
studentSchema.index({ studentId: 1 });

module.exports = mongoose.model('Student', studentSchema);
