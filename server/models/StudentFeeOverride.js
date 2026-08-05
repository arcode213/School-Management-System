const mongoose = require('mongoose');

const studentFeeOverrideSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', required: true },
    
    customTuitionFee: { type: Number },
    customTransportFee: { type: Number },
    customMiscFee: { type: Number },

    // Per-student annual fee for this session, replacing the class default. Like the
    // fields above it is deliberately OPTIONAL with no schema default: undefined means
    // "no override, use the class fee structure", which is a different statement from
    // an override of 0 (a student the school has excused the annual fee for entirely).
    customAnnualFee: { type: Number },

    reason: { type: String },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Only one active override per student per session
studentFeeOverrideSchema.index({ student: 1, academicSession: 1 }, { unique: true });

module.exports = mongoose.model('StudentFeeOverride', studentFeeOverrideSchema);
