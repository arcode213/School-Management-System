const Student = require('../models/Student');

// Helper: auto-generate studentId safely
const generateStudentId = async () => {
  const year = new Date().getFullYear();
  const count = await Student.countDocuments();
  return `SMS-${year}-${String(count + 1).padStart(3, '0')}`;
};

// @desc    Add a new student
// @route   POST /api/students
const addStudent = async (req, res) => {
  try {
    const studentId = await generateStudentId();
    const student = await Student.create({ ...req.body, studentId });
    res.status(201).json(student);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Duplicate entry', field: Object.keys(err.keyValue)[0] });
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all students (with filtering & pagination)
// @route   GET /api/students?class=&section=&status=&search=&page=&limit=
const getStudents = async (req, res) => {
  try {
    const { class: cls, section, status, search, page = 1, limit = 10 } = req.query;
    const filter = { isDeleted: false };

    if (cls)     filter.class   = cls;
    if (section) filter.section = section;
    if (status)  filter.status  = status;
    if (search) {
      filter.$or = [
        { fullName:   { $regex: search, $options: 'i' } },
        { studentId:  { $regex: search, $options: 'i' } },
        { fatherName: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Student.countDocuments(filter);
    const students = await Student.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      students,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get single student by ID
// @route   GET /api/students/:id
const getStudent = async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, isDeleted: false });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
const updateStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Soft delete student
// @route   DELETE /api/students/:id
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true, status: 'Left' } },
      { new: true }
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Student removed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get distinct classes
// @route   GET /api/students/classes
const getClasses = async (req, res) => {
  try {
    const classes = await Student.distinct('class', { isDeleted: false });
    res.json(classes.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { addStudent, getStudents, getStudent, updateStudent, deleteStudent, getClasses };
