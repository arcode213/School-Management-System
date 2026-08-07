const mongoose = require('mongoose');

/**
 * One row per action taken in the system: who did it, what they did, to which
 * record, when, and exactly which fields moved.
 *
 * The actor's name, email and role are copied in rather than only referenced.
 * A log that reads "user 64f2… changed a fee" the day after that account is
 * deleted is no record at all — the whole point is that it still answers the
 * question months later, so it must not depend on rows that can disappear.
 *
 * Nothing here is ever updated. Entries are written once and read thereafter.
 */
const changeSchema = new mongoose.Schema(
  {
    field: String,
    label: String,   // human name for the field, e.g. "Amount Paid"
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const auditLogSchema = new mongoose.Schema(
  {
    // --- who ---------------------------------------------------------------
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, default: 'Unknown' },
    userEmail: { type: String, default: '' },
    userRole: { type: String, default: '' },

    // --- what --------------------------------------------------------------
    action: {
      type: String,
      required: true,
      enum: [
        'create', 'update', 'delete', 'bulk-create', 'bulk-update',
        'login', 'login-failed', 'logout', 'reset-data', 'denied', 'other',
      ],
      index: true,
    },
    module: { type: String, default: 'other', index: true }, // permission module key
    entity: { type: String, default: '' },                   // model name, e.g. 'FeeRecord'
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    entityLabel: { type: String, default: '' },              // e.g. challan no / student name
    description: { type: String, default: '' },              // one readable sentence

    // Field-level before/after. Empty for creates and deletes, where the whole
    // record is the change and `snapshot` carries it instead.
    changes: { type: [changeSchema], default: [] },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: undefined },

    // --- where / how -------------------------------------------------------
    campus: { type: mongoose.Schema.Types.ObjectId, ref: 'Campus', default: null },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession', default: null },
    method: { type: String, default: '' },
    path: { type: String, default: '' },
    statusCode: { type: Number, default: 0 },
    success: { type: Boolean, default: true, index: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

// The log is written far more often than it is read, and it is read almost
// entirely as "newest first, optionally narrowed" — so every filter the screen
// offers is paired with createdAt.
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ campus: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
