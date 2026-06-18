const mongoose = require('mongoose');

const campusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    principalName: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

campusSchema.index({ name: 1, code: 1 });

module.exports = mongoose.model('Campus', campusSchema);
