const mongoose = require('mongoose');

const academicSessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // e.g., "2024-2025"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    status: { type: String, enum: ['Upcoming', 'Ongoing', 'Completed'], default: 'Ongoing' },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Ensure only one session can be active at a time
academicSessionSchema.pre('save', async function (next) {
  if (this.isModified('isActive') && this.isActive) {
    await mongoose.model('AcademicSession').updateMany(
      { _id: { $ne: this._id } },
      { $set: { isActive: false, status: 'Completed' } }
    );
  }
  next();
});

module.exports = mongoose.model('AcademicSession', academicSessionSchema);
