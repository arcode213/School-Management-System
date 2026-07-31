const Campus = require('../models/Campus');
const AcademicSession = require('../models/AcademicSession');
const Student = require('../models/Student');
const FeeStructure = require('../models/FeeStructure');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');
const StudentFeeOverride = require('../models/StudentFeeOverride');
const FeeRecord = require('../models/FeeRecord');
const Employee = require('../models/Employee');
const SalaryRecord = require('../models/SalaryRecord');

// @desc    Get all active campuses
// @route   GET /api/system/campuses
const getCampuses = async (req, res) => {
  try {
    const campuses = await Campus.find({ isActive: true, isDeleted: false }).sort({ name: 1 });
    res.json(campuses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all academic sessions
// @route   GET /api/system/sessions
const getSessions = async (req, res) => {
  try {
    const sessions = await AcademicSession.find({ isDeleted: false }).sort({ startDate: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create a new campus
// @route   POST /api/system/campuses
const createCampus = async (req, res) => {
  try {
    const { name, code, address, contactNumber, phone, isActive } = req.body;
    const campus = await Campus.create({ name, code, address, phone: phone || contactNumber, isActive });
    res.status(201).json(campus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a campus
// @route   PUT /api/system/campuses/:id
const updateCampus = async (req, res) => {
  try {
    // The settings form sends the phone as `contactNumber`; map it to the
    // schema's `phone` field so edits actually persist (create already does this).
    const updates = { ...req.body };
    if (updates.contactNumber !== undefined) {
      updates.phone = updates.phone || updates.contactNumber;
      delete updates.contactNumber;
    }
    const campus = await Campus.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!campus) return res.status(404).json({ message: 'Campus not found' });
    res.json(campus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Soft-delete a campus
// @route   DELETE /api/system/campuses/:id
const deleteCampus = async (req, res) => {
  try {
    const campus = await Campus.findByIdAndUpdate(
      req.params.id,
      { $set: { isDeleted: true, isActive: false } },
      { new: true }
    );
    if (!campus) return res.status(404).json({ message: 'Campus not found' });
    res.json({ message: 'Campus deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create a new session
// @route   POST /api/system/sessions
const createSession = async (req, res) => {
  try {
    const { name, startDate, endDate, isActive, status } = req.body;
    
    // If setting to active, deactivate others
    if (isActive) {
      await AcademicSession.updateMany({}, { isActive: false });
    }
    
    const session = await AcademicSession.create({ name, startDate, endDate, isActive, status });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a session
// @route   PUT /api/system/sessions/:id
const updateSession = async (req, res) => {
  try {
    if (req.body.isActive) {
      await AcademicSession.updateMany({ _id: { $ne: req.params.id } }, { isActive: false });
    }
    
    const session = await AcademicSession.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Soft-delete a session
// @route   DELETE /api/system/sessions/:id
const deleteSession = async (req, res) => {
  try {
    const session = await AcademicSession.findByIdAndUpdate(
      req.params.id,
      { $set: { isDeleted: true, isActive: false } },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// The phrase the caller must type back before anything is removed. Deliberately
// exact and deliberately annoying to type — this endpoint is unrecoverable.
const RESET_CONFIRMATION = 'DELETE DATA';

// The data the caller can pick from. Campuses, academic sessions and user accounts
// are deliberately NOT offered: deleting a campus or session orphans everything
// filed under it, and deleting users would lock the school out of its own system.
const RESET_GROUPS = {
  students: { label: 'Students & academic records', models: [['academic records', StudentAcademicRecord], ['students', Student]] },
  fees: { label: 'Challans, payments & dues', models: [['fee records', FeeRecord]] },
  feeOverrides: { label: 'Per-student fee overrides', models: [['student fee overrides', StudentFeeOverride]] },
  employees: { label: 'Employees', models: [['employees', Employee]] },
  salaries: { label: 'Salary records', models: [['salary records', SalaryRecord]] },
  feeStructures: { label: 'Class fee structures', models: [['fee structures', FeeStructure]] },
};

// Deleting a parent has to take its dependents with it. A challan or a fee override
// left behind after its student is gone points at nothing, and every screen that
// joins the two would show blank rows for records that can never be cleaned up.
const RESET_DEPENDENCIES = {
  students: ['fees', 'feeOverrides'],
  employees: ['salaries'],
};

// Children before parents, so nothing is briefly left dangling mid-delete.
const RESET_ORDER = ['fees', 'feeOverrides', 'students', 'salaries', 'employees', 'feeStructures'];

// Add everything the chosen groups drag along with them.
const expandGroups = (groups) => {
  const set = new Set(groups);
  for (const [parent, dependents] of Object.entries(RESET_DEPENDENCIES)) {
    if (set.has(parent)) dependents.forEach(d => set.add(d));
  }
  return set;
};

// @desc    Permanently delete the selected students / fees / employees / salaries
// @route   POST /api/system/reset-data
const resetData = async (req, res) => {
  try {
    if (req.body?.confirm !== RESET_CONFIRMATION) {
      return res.status(400).json({
        message: `Type "${RESET_CONFIRMATION}" to confirm. Nothing was deleted.`,
      });
    }

    const requested = Array.isArray(req.body?.groups) ? req.body.groups : [];
    const unknown = requested.filter(g => !RESET_GROUPS[g]);
    if (unknown.length > 0) {
      return res.status(400).json({ message: `Unknown data type(s): ${unknown.join(', ')}. Nothing was deleted.` });
    }
    if (requested.length === 0) {
      return res.status(400).json({ message: 'Select at least one type of data to delete. Nothing was deleted.' });
    }

    const selected = expandGroups(requested);

    // Hard deletes, not the soft `isDeleted` flag used elsewhere: the point of this
    // action is to leave nothing behind for the next import to collide with.
    const deleted = {};
    for (const key of RESET_ORDER) {
      if (!selected.has(key)) continue;
      for (const [label, Model] of RESET_GROUPS[key].models) {
        const result = await Model.deleteMany({});
        deleted[label] = result.deletedCount || 0;
      }
    }

    const total = Object.values(deleted).reduce((a, b) => a + b, 0);
    const cleared = [...selected].map(k => RESET_GROUPS[k].label);
    res.json({
      message: total === 0
        ? 'There was nothing to delete for the selected data.'
        : `Deleted ${total} record(s): ${cleared.join(', ')}.`,
      deleted,
      cleared: [...selected],
      total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getCampuses, createCampus, updateCampus, deleteCampus,
  getSessions, createSession, updateSession, deleteSession,
  resetData, RESET_CONFIRMATION, RESET_GROUPS, RESET_DEPENDENCIES
};
