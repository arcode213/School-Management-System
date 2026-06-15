const FeeRecord = require('../models/FeeRecord');
const Student = require('../models/Student');

// @desc    Record a single fee payment
// @route   POST /api/fees
const addFee = async (req, res) => {
  try {
    const fee = await FeeRecord.create(req.body);
    res.status(201).json(fee);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Duplicate receipt number.' });
    res.status(500).json({ message: err.message });
  }
};

// @desc    Bulk post fees for a class
// @route   POST /api/fees/bulk
const addBulkFees = async (req, res) => {
  try {
    const { class: studentClass, section, feeMonth, feeYear, tuitionFee, examFee, transportFee, otherFee } = req.body;
    
    const filter = { class: studentClass, isDeleted: false, status: 'Active' };
    if (section) filter.section = section;

    const students = await Student.find(filter);
    if (students.length === 0) return res.status(404).json({ message: 'No active students found in this class/section' });

    const feeRecords = [];
    for (const student of students) {
      // Check if already posted
      const exists = await FeeRecord.findOne({ student: student._id, feeMonth, feeYear, isDeleted: false });
      if (!exists) {
        feeRecords.push({
          student: student._id,
          feeMonth,
          feeYear,
          tuitionFee: tuitionFee || 0,
          examFee: examFee || 0,
          transportFee: transportFee || 0,
          otherFee: otherFee || 0,
        });
      }
    }

    if (feeRecords.length === 0) {
      return res.status(400).json({ message: 'Fees already posted for all students in this criteria.' });
    }

    const created = await FeeRecord.insertMany(feeRecords);
    res.status(201).json({ message: `Successfully posted fees for ${created.length} students.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all fee records
// @route   GET /api/fees
const getFees = async (req, res) => {
  try {
    const { feeMonth, feeYear, status, class: studentClass, page = 1, limit = 15 } = req.query;
    
    // Build aggregation pipeline to allow filtering by populated student class
    const matchStage = { isDeleted: false };
    if (feeMonth) matchStage.feeMonth = feeMonth;
    if (feeYear) matchStage.feeYear = Number(feeYear);
    if (status) matchStage.status = status;

    const pipeline = [
      { $match: matchStage },
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'studentInfo' } },
      { $unwind: '$studentInfo' },
    ];

    if (studentClass) {
      pipeline.push({ $match: { 'studentInfo.class': studentClass } });
    }

    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await FeeRecord.aggregate(countPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Pagination & sorting
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: (Number(page) - 1) * Number(limit) });
    pipeline.push({ $limit: Number(limit) });

    const fees = await FeeRecord.aggregate(pipeline);

    res.json({
      fees,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get fees for a single student
// @route   GET /api/fees/student/:id
const getStudentFees = async (req, res) => {
  try {
    const fees = await FeeRecord.find({ student: req.params.id, isDeleted: false })
      .sort({ feeYear: -1, createdAt: -1 });
    res.json(fees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get students with outstanding dues
// @route   GET /api/fees/dues
const getDues = async (req, res) => {
  try {
    const dues = await FeeRecord.find({ isDeleted: false, status: { $in: ['Unpaid', 'Partial'] } })
      .populate('student', 'fullName studentId class section phone')
      .sort({ feeYear: 1, createdAt: 1 });
    res.json(dues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a fee record (e.g. paying dues)
// @route   PUT /api/fees/:id
const updateFee = async (req, res) => {
  try {
    // Manually trigger pre-save hook logic by finding, updating, and saving
    const fee = await FeeRecord.findOne({ _id: req.params.id, isDeleted: false });
    if (!fee) return res.status(404).json({ message: 'Fee record not found' });

    Object.assign(fee, req.body);
    await fee.save(); // triggers calculation logic

    res.json(fee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete fee record
// @route   DELETE /api/fees/:id
const deleteFee = async (req, res) => {
  try {
    const fee = await FeeRecord.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!fee) return res.status(404).json({ message: 'Fee record not found' });
    res.json({ message: 'Fee record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get single fee record by ID
// @route   GET /api/fees/:id
const getFee = async (req, res) => {
  try {
    const fee = await FeeRecord.findOne({ _id: req.params.id, isDeleted: false })
      .populate('student', 'fullName studentId class section rollNumber fatherName phone address');
    if (!fee) return res.status(404).json({ message: 'Fee record not found' });
    res.json(fee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  addFee, addBulkFees, getFees, getStudentFees, getDues, updateFee, deleteFee, getFee
};
