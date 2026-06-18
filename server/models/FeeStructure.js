const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema(
  {
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    className: { type: String, required: true },
    tuitionFee: { type: Number, default: 0 },
    admissionFee: { type: Number, default: 0 },
    examFee: { type: Number, default: 0 },
    transportFee: { type: Number, default: 0 },
    miscFee: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One active fee structure per class per campus per session
feeStructureSchema.index({ campus: 1, academicSession: 1, className: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
