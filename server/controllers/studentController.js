const mongoose = require('mongoose');
const Student = require('../models/Student');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');
const FeeRecord = require('../models/FeeRecord');
const FeeStructure = require('../models/FeeStructure');
const StudentFeeOverride = require('../models/StudentFeeOverride');
const { getNextSeqNumber, formatSeqId, generateSequentialId } = require('../utils/sequentialId');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Helper: auto-generate a collision-safe studentId (derived from the max
// existing suffix, so it survives hard-deleted records).
const generateStudentId = (session) => generateSequentialId(Student, 'studentId', 'SMS', session);

// @desc    Add a new student
// @route   POST /api/students
const addStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus || !currentSession) {
      throw new Error('Campus and Academic Session context are required');
    }

    const { class: className, section, rollNumber, status, feeStructure, previousDues, ...personalDetails } = req.body;

    const studentId = await generateStudentId(session);
    
    // Create personal record
    const student = new Student({
      ...personalDetails,
      studentId,
      currentCampus
    });
    await student.save({ session });

    // Normalize roll number (empty/null becomes undefined so it's not indexed as a duplicate string)
    const cleanRollNumber = (rollNumber === '' || rollNumber === null || rollNumber === undefined) ? undefined : rollNumber;

    // Create academic record
    const academicRecord = new StudentAcademicRecord({
      student: student._id,
      campus: currentCampus,
      academicSession: currentSession,
      className: className || 'Unassigned',
      section,
      rollNumber: cleanRollNumber,
      status: status || 'Active',
      feeStructure,
      admissionDate: personalDetails.admissionDate
    });
    await academicRecord.save({ session });

    // Handle previous dues
    if (previousDues && Number(previousDues) > 0) {
      const arrearsRecord = new FeeRecord({
        challanNo: `ARR-${studentId}-${Date.now()}`,
        student: student._id,
        studentAcademicRecord: academicRecord._id,
        campus: currentCampus,
        academicSession: currentSession,
        feeMonth: MONTHS[new Date().getMonth()],
        feeYear: new Date().getFullYear(),
        dueMonthRange: 'Previous Arrears',
        tuitionFee: 0,
        examFee: 0,
        transportFee: 0,
        miscFee: 0,
        previousDues: Number(previousDues),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 10))
      });
      await arrearsRecord.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    // Format response
    const result = { ...student.toJSON(), class: academicRecord.className, section: academicRecord.section, rollNumber: academicRecord.rollNumber, status: academicRecord.status };
    res.status(201).json(result);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (err.code === 11000) return res.status(400).json({ message: 'Duplicate entry', field: Object.keys(err.keyValue)[0] });
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all students (with filtering & pagination)
// @route   GET /api/students?class=&section=&status=&search=&page=&limit=
const getStudents = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const { class: cls, section, status, search, gender, page = 1, limit = 10 } = req.query;

    const matchPipeline = {
      isDeleted: false
    };

    if (currentCampus) matchPipeline.campus = new mongoose.Types.ObjectId(currentCampus);
    if (currentSession) matchPipeline.academicSession = new mongoose.Types.ObjectId(currentSession);
    if (cls) matchPipeline.className = cls;
    if (section) matchPipeline.section = section;
    if (status) matchPipeline.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    // Build aggregation to join Student data for searching
    const pipeline = [
      { $match: matchPipeline },
      {
        $lookup: {
          from: 'students',
          localField: 'student',
          foreignField: '_id',
          as: 'studentData'
        }
      },
      { $unwind: '$studentData' },
      { $match: { 'studentData.isDeleted': false } }
    ];

    if (gender) {
      pipeline.push({ $match: { 'studentData.gender': gender } });
    }

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'studentData.fullName': { $regex: search, $options: 'i' } },
            { 'studentData.studentId': { $regex: search, $options: 'i' } },
            { 'studentData.fatherName': { $regex: search, $options: 'i' } },
            { rollNumber: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await StudentAcademicRecord.aggregate(countPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    const dataPipeline = [
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: Number(limit) }
    ];

    const records = await StudentAcademicRecord.aggregate(dataPipeline);

    // Format output to match old frontend format
    const students = records.map(r => ({
      ...r.studentData,
      _id: r.studentData._id, // student id is the primary _id
      academicRecordId: r._id,
      class: r.className,
      section: r.section,
      rollNumber: r.rollNumber,
      status: r.status
    }));

    res.json({
      students,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get single student by ID with history
// @route   GET /api/students/:id
const getStudent = async (req, res) => {
  try {
    const student = await Student.findOne({ _id: req.params.id, isDeleted: false });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const academicHistory = await StudentAcademicRecord.find({ student: student._id, isDeleted: false })
      .populate('academicSession', 'name startDate endDate isActive')
      .populate('campus', 'name code')
      .sort({ createdAt: -1 });

    const result = student.toJSON();
    result.academicHistory = academicHistory;

    // Determine the "current" academic record — prefer the one for the selected
    // session, otherwise the most recent.
    const { currentCampus, currentSession } = req;
    let current = academicHistory[0];
    if (currentSession) {
      const match = academicHistory.find(r => r.academicSession?._id?.toString() === currentSession.toString());
      if (match) current = match;
    }

    // Mount current context fields for quick form binding
    if (current) {
      result.class = current.className;
      result.section = current.section;
      result.rollNumber = current.rollNumber;
      result.status = current.status;
      result.academicRecordId = current._id;

      // Effective monthly fee = class fee structure with any per-student
      // override applied (mirrors the fee/challan generation logic).
      const campusId = current.campus?._id || currentCampus;
      const sessionId = current.academicSession?._id || currentSession;
      const [struct, override] = await Promise.all([
        FeeStructure.findOne({ campus: campusId, academicSession: sessionId, className: current.className }),
        StudentFeeOverride.findOne({ student: student._id, campus: campusId, academicSession: sessionId, isActive: true }),
      ]);
      const pick = (custom, base) => (custom !== undefined && custom !== null ? custom : (base || 0));
      const tuitionFee = pick(override?.customTuitionFee, struct?.tuitionFee);
      const transportFee = pick(override?.customTransportFee, struct?.transportFee);
      const miscFee = pick(override?.customMiscFee, struct?.miscFee);
      result.feeInfo = {
        className: current.className,
        tuitionFee,
        transportFee,
        miscFee,
        admissionFee: struct?.admissionFee || 0,
        examFee: struct?.examFee || 0,
        monthlyTotal: tuitionFee + transportFee + miscFee,
        hasStructure: !!struct,
        hasOverride: !!override,
      };
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update student (both personal and current academic record)
// @route   PUT /api/students/:id
const updateStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { currentCampus, currentSession } = req;
    const { class: className, section, rollNumber, status, feeStructure, academicRecordId, ...personalDetails } = req.body;

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: personalDetails },
      { new: true, runValidators: true, session }
    );
    if (!student) throw new Error('Student not found');

    let academicRecord;
    const updatePayload = { className, section, status, feeStructure };
    const unsetPayload = {};
    
    if (rollNumber === '' || rollNumber === null || rollNumber === undefined) {
      unsetPayload.rollNumber = '';
    } else {
      updatePayload.rollNumber = rollNumber;
    }

    const updateObj = { $set: updatePayload };
    if (Object.keys(unsetPayload).length > 0) {
      updateObj.$unset = unsetPayload;
    }

    if (academicRecordId) {
      academicRecord = await StudentAcademicRecord.findByIdAndUpdate(
        academicRecordId,
        updateObj,
        { new: true, runValidators: true, session }
      );
    } else if (currentCampus && currentSession) {
      academicRecord = await StudentAcademicRecord.findOneAndUpdate(
        { student: student._id, academicSession: currentSession, campus: currentCampus },
        updateObj,
        { new: true, runValidators: true, session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    const result = student.toJSON();
    if (academicRecord) {
      result.class = academicRecord.className;
      result.section = academicRecord.section;
      result.rollNumber = academicRecord.rollNumber;
      result.status = academicRecord.status;
    }

    res.json(result);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

// @desc    Soft delete student
// @route   DELETE /api/students/:id
const deleteStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true, session }
    );
    if (!student) throw new Error('Student not found');

    // Mark all academic records as Left
    await StudentAcademicRecord.updateMany(
      { student: student._id, isDeleted: false },
      { $set: { status: 'Left' } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    res.json({ message: 'Student removed successfully' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get distinct classes
// @route   GET /api/students/classes
const getClasses = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const filter = { isDeleted: false, status: 'Active' };
    if (currentCampus) filter.campus = new mongoose.Types.ObjectId(currentCampus);
    if (currentSession) filter.academicSession = new mongoose.Types.ObjectId(currentSession);

    const classes = await StudentAcademicRecord.distinct('className', filter);
    res.json(classes.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Bulk Add Students
// @route   POST /api/students/bulk
const bulkAddStudents = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus || !currentSession) {
      throw new Error('Campus and Academic Session context are required');
    }

    const studentsData = req.body.students;
    if (!studentsData || !Array.isArray(studentsData)) {
      throw new Error('Invalid data format. Expected an array of students.');
    }

    const addedStudents = [];

    // Pre-calculate the starting sequence number (max existing suffix + 1),
    // then increment locally for each imported record.
    let nextSeq = await getNextSeqNumber(Student, 'studentId', 'SMS', session);

    for (let i = 0; i < studentsData.length; i++) {
      const studentObj = studentsData[i];
      const { class: className, section, rollNumber, status, feeStructure, previousDues, ...personalDetails } = studentObj;

      const studentId = formatSeqId('SMS', nextSeq++);

      // Create personal record
      const student = new Student({
        ...personalDetails,
        studentId,
        currentCampus
      });
      await student.save({ session });

      // Create academic record
      const academicRecord = new StudentAcademicRecord({
        student: student._id,
        campus: currentCampus,
        academicSession: currentSession,
        className: className || 'Unassigned',
        section,
        rollNumber,
        status: status || 'Active',
        feeStructure,
        admissionDate: personalDetails.admissionDate || Date.now()
      });
      await academicRecord.save({ session });

      if (previousDues && Number(previousDues) > 0) {
        const arrearsRecord = new FeeRecord({
          challanNo: `ARR-${studentId}-${Date.now()}-${i}`,
          student: student._id,
          studentAcademicRecord: academicRecord._id,
          campus: currentCampus,
          academicSession: currentSession,
          feeMonth: MONTHS[new Date().getMonth()],
          feeYear: new Date().getFullYear(),
          dueMonthRange: 'Previous Arrears',
          tuitionFee: 0,
          examFee: 0,
          transportFee: 0,
          miscFee: 0,
          previousDues: Number(previousDues),
          dueDate: new Date(new Date().setDate(new Date().getDate() + 10))
        });
        await arrearsRecord.save({ session });
      }

      addedStudents.push({ ...student.toJSON(), class: academicRecord.className, section: academicRecord.section, rollNumber: academicRecord.rollNumber, status: academicRecord.status });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: `${addedStudents.length} students imported successfully`, students: addedStudents });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (err.code === 11000) return res.status(400).json({ message: 'Duplicate entry', field: Object.keys(err.keyValue)[0] });
    res.status(500).json({ message: err.message });
  }
};

module.exports = { addStudent, getStudents, getStudent, updateStudent, deleteStudent, getClasses, bulkAddStudents };
