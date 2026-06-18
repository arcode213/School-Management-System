const Campus = require('../models/Campus');
const AcademicSession = require('../models/AcademicSession');

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
    const campus = await Campus.findByIdAndUpdate(req.params.id, req.body, { new: true });
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

module.exports = {
  getCampuses, createCampus, updateCampus, deleteCampus,
  getSessions, createSession, updateSession, deleteSession
};
