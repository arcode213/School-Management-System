const AuditLog = require('../models/AuditLog');
// Required for its own sake, not for a reference: `getLogs` populates `campus`,
// and populate needs the model registered on this connection. Leaving it to be
// pulled in by whichever other controller happens to load first is how a screen
// ends up 500-ing depending on which routes were touched beforehand.
require('../models/Campus');
const { MODULES } = require('../config/permissions');

const ACTIONS = [
  { key: 'create', label: 'Created' },
  { key: 'update', label: 'Updated' },
  { key: 'delete', label: 'Deleted' },
  { key: 'bulk-create', label: 'Bulk import' },
  { key: 'bulk-update', label: 'Bulk update' },
  { key: 'login', label: 'Signed in' },
  { key: 'login-failed', label: 'Failed sign-in' },
  { key: 'denied', label: 'Access denied' },
  { key: 'reset-data', label: 'Data reset' },
  { key: 'other', label: 'Other' },
];

// @desc    Read the audit trail, newest first
// @route   GET /api/logs
// @access  Private/Admin
const getLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const filter = {};
    if (req.query.user) filter.user = req.query.user;
    if (req.query.module) filter.module = req.query.module;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.campus) filter.campus = req.query.campus;
    if (req.query.success === 'true') filter.success = true;
    if (req.query.success === 'false') filter.success = false;

    // Dates arrive as plain YYYY-MM-DD. `to` is pushed to the end of that day so
    // "1st to 5th" includes everything that happened on the 5th, which is what
    // anyone picking those dates means.
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(`${req.query.from}T00:00:00.000Z`);
      if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999Z`);
    }

    if (req.query.search) {
      const rx = new RegExp(req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { description: rx }, { entityLabel: rx }, { userName: rx },
        { userEmail: rx }, { path: rx },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('campus', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({
      logs,
      pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    The filter options and headline counts the log screen needs
// @route   GET /api/logs/meta
// @access  Private/Admin
const getLogMeta = async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [users, total, today, failures, byModule] = await Promise.all([
      // Everyone who appears in the log, not just current accounts — a deleted
      // user's actions are still in the trail and must stay filterable.
      AuditLog.aggregate([
        { $group: { _id: '$user', name: { $last: '$userName' }, email: { $last: '$userEmail' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AuditLog.countDocuments({}),
      AuditLog.countDocuments({ createdAt: { $gte: since } }),
      AuditLog.countDocuments({ success: false, createdAt: { $gte: since } }),
      AuditLog.aggregate([
        { $group: { _id: '$module', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      users: users.filter(u => u._id).map(u => ({ _id: u._id, name: u.name, email: u.email, count: u.count })),
      modules: [
        ...MODULES.map(m => ({ key: m.key, label: m.label })),
        { key: 'auth', label: 'Sign-in' },
        { key: 'users', label: 'User Accounts' },
        { key: 'other', label: 'Other' },
      ],
      actions: ACTIONS,
      stats: { total, today, failures, byModule },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Everything that ever happened to one record
// @route   GET /api/logs/entity/:entity/:id
// @access  Private/Admin
const getEntityHistory = async (req, res) => {
  try {
    const logs = await AuditLog.find({ entity: req.params.entity, entityId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getLogs, getLogMeta, getEntityHistory };
