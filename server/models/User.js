const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { effectivePermissions, basePermissions, hasPermission } = require('../config/permissions');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['Admin', 'Administrator', 'Staff'],
      default: 'Staff',
    },

    // The account's home campus. Kept because existing accounts are scoped by it
    // and the client uses it to pick a default; `campusScope` is what actually
    // limits access now.
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', default: null },

    // Which campuses / sessions this account may work in. Empty means unrestricted
    // — that is what every account created before this feature has, so nobody
    // loses access by upgrading.
    campusScope: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campus' }],
    sessionScope: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' }],

    // { students: { view: true, create: false, … }, … } — see config/permissions.js.
    // Mixed because the module list is a catalogue, not a fixed schema; every write
    // goes through sanitizePermissions() so only known keys are ever stored.
    // Absent (not just empty) means "fall back to the role's historic access".
    // This is the DEFAULT grid: it applies at every campus that has no override.
    permissions: { type: mongoose.Schema.Types.Mixed, default: undefined },

    // { <campusId>: <grid> } — a different set of rights at a particular campus.
    // Someone may run the office at the main campus and only collect fees at the
    // second; a campus listed here uses its own grid instead of the default.
    campusPermissions: { type: mongoose.Schema.Types.Mixed, default: undefined },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// The grid this account is judged by at a given campus, role fallback included.
// Without a campus this answers with the default grid.
userSchema.methods.effectivePermissions = function (campusId = null) {
  return effectivePermissions(this, campusId);
};

userSchema.methods.basePermissions = function () {
  return basePermissions(this);
};

userSchema.methods.can = function (moduleKey, action = 'view', campusId = null) {
  return hasPermission(this, moduleKey, action, campusId);
};

/**
 * The campuses / sessions this account is confined to, as plain id strings.
 * An empty array means no restriction. `campus` is folded in so accounts created
 * before `campusScope` existed stay pinned to their single campus.
 */
userSchema.methods.allowedCampusIds = function () {
  const ids = (this.campusScope || []).map(id => id.toString());
  if (ids.length === 0 && this.campus) ids.push(this.campus.toString());
  return ids;
};

userSchema.methods.allowedSessionIds = function () {
  return (this.sessionScope || []).map(id => id.toString());
};

module.exports = mongoose.model('User', userSchema);
