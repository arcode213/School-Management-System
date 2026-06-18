const mongoose = require('mongoose');

const studentFeeOverrideSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    
    customTuitionFee: { type: Number },
    customTransportFee: { type: Number },
    customMiscFee: { type: Number },
    
    reason: { type: String },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Only one active override per student per session
studentFeeOverrideSchema.index({ student: 1, academicSession: 1 }, { unique: true });

module.exports = mongoose.model('StudentFeeOverride', studentFeeOverrideSchema);
