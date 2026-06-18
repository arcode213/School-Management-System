const mongoose = require('mongoose');

const studentAcademicRecordSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
    className: { type: String, required: true }, // renamed from 'class' to avoid JS reserved word issues
    section: { type: String },
    rollNumber: { type: String },
    status: { type: String, enum: ['Active', 'Left', 'Graduated', 'Failed', 'Promoted'], default: 'Active' },
    promotionStatus: { type: String }, // Details regarding promotion e.g., 'Promoted to Class 6'
    admissionDate: { type: Date, default: Date.now },
    feeStructure: {
      tuitionFee: { type: Number, default: 0 },
      transportFee: { type: Number, default: 0 }
    },
    remarks: { type: String },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Prevent duplicate roll numbers in the same class, session, and campus
studentAcademicRecordSchema.index(
  { campus: 1, academicSession: 1, className: 1, rollNumber: 1 },
  { unique: true, partialFilterExpression: { rollNumber: { $type: "string" }, isDeleted: false } }
);

studentAcademicRecordSchema.index({ student: 1, academicSession: 1 });
studentAcademicRecordSchema.index({ campus: 1, className: 1 });

module.exports = mongoose.model('StudentAcademicRecord', studentAcademicRecordSchema);
