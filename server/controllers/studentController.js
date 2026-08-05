const mongoose = require('mongoose');
const Student = require('../models/Student');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');
const FeeRecord = require('../models/FeeRecord');
const FeeStructure = require('../models/FeeStructure');
const StudentFeeOverride = require('../models/StudentFeeOverride');
const { getNextSeqNumber, formatSeqId, generateSequentialId } = require('../utils/sequentialId');
const { buildArrearsPeriod, MONTHS } = require('../utils/feeMonths');
const { normalizeStudentRow } = require('../utils/importNormalizer');

// Helper: auto-generate a collision-safe studentId (derived from the max
// existing suffix, so it survives hard-deleted records).
const generateStudentId = (session) => generateSequentialId(Student, 'studentId', 'SMS', session);

// Spreadsheet-friendly boolean. An imported column may hold a real boolean, 1/0,
// or free text like "Yes" / "Freeship", so accept all of them.
const parseBoolean = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v !== 'string') return false;
  return ['yes', 'y', 'true', '1', 'freeship', 'free'].includes(v.trim().toLowerCase());
};

// Empty/blank roll numbers must become undefined, not '', or the partial unique
// index (which only covers string values) treats every blank as the same roll
// number and rejects the second student.
const cleanRoll = (v) => (v === '' || v === null || v === undefined ? undefined : String(v));

// Build the synthetic "opening arrears" challan for a student admitted or imported
// with a pre-existing balance. `from`/`to` describe the months the MONTHLY balance
// covers and drive the range printed on the challan; the annual amount is a one-off
// with no month range of its own. Returns null when nothing is owed on either side.
const buildOpeningArrears = ({
  challanNo, student, academicRecord, campus, academicSession, amount, from, to, annualAmount,
}) => {
  const monthlyDues = Number(amount) > 0 ? Number(amount) : 0;
  const annualDues = Number(annualAmount) > 0 ? Number(annualAmount) : 0;
  if (monthlyDues <= 0 && annualDues <= 0) return null;

  const period = buildArrearsPeriod(from, to);

  // The "Previous Arrears" fallback label only makes sense when monthly arrears
  // exist. For an annual-fee-only opening balance, use the plain month instead.
  const dueMonthRange =
    monthlyDues <= 0 && period.dueMonthRange === 'Previous Arrears' ? period.feeMonth : period.dueMonthRange;

  // An opening balance states the full amount owed for its own range, so the months
  // its monthly arrears cover ARE that range (unlike a normal challan, where the
  // arrears stop the month before the one being billed).
  const arrearsFromMonth = monthlyDues > 0 ? (period.startMonth || period.endMonth) : undefined;
  const arrearsToMonth = monthlyDues > 0 ? period.endMonth : undefined;

  return new FeeRecord({
    challanNo,
    student,
    studentAcademicRecord: academicRecord,
    campus,
    academicSession,
    feeMonth: period.feeMonth,
    feeYear: period.feeYear,
    dueMonthRange,
    tuitionFee: 0,
    examFee: 0,
    transportFee: 0,
    miscFee: 0,
    annualFee: 0,
    previousDues: monthlyDues,
    previousAnnualDues: annualDues,
    arrearsFromMonth,
    arrearsToMonth,
    isOpeningBalance: true,
    dueDate: new Date(new Date().setDate(new Date().getDate() + 10)),
  });
};

// Records THIS session's annual fee as already charged AND already settled, for a
// student who paid it before the school started using the system.
//
// It is a fully-paid challan rather than a flag because that is what the rest of the
// fee engine already reads. The generator decides whether to charge the annual fee by
// looking for a challan of the session carrying one (`findSessionAnnualCharges`), and
// decides how much is still owed from the unpaid balances. A settled record answers
// both questions correctly on its own: the student counts as charged, so the fee is
// never added again, and it owes nothing, so nothing carries forward. Returns null
// when the amount is 0 or blank — meaning "not paid yet", which leaves the student to
// be charged normally by Generate Fees.
const buildPaidAnnualFee = ({ challanNo, student, academicRecord, campus, academicSession, amount }) => {
  const paid = Number(amount) > 0 ? Number(amount) : 0;
  if (paid <= 0) return null;

  const now = new Date();
  const feeMonth = MONTHS[now.getMonth()];

  return new FeeRecord({
    challanNo,
    student,
    studentAcademicRecord: academicRecord,
    campus,
    academicSession,
    feeMonth,
    feeYear: now.getFullYear(),
    dueMonthRange: feeMonth,
    // No monthly charges: an annual fee belongs to no month, and any monthly arrears
    // are carried by their own opening-balance record.
    tuitionFee: 0,
    examFee: 0,
    transportFee: 0,
    miscFee: 0,
    annualFee: paid,
    previousDues: 0,
    previousAnnualDues: 0,
    amountPaid: paid,
    // Earmarked against the annual bucket so the pre-save allocation puts it there and
    // not against months (see the allocation rule on FeeRecord).
    annualPaid: paid,
    paymentDate: now,
    // Flagged like the opening-arrears record: it is a statement of what was already
    // settled before the import, not a voucher, so it is never printed.
    isOpeningBalance: true,
    dueDate: now,
    remarks: 'Annual fee already paid for this session — recorded at import.',
  });
};

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

    const {
      class: className, section, rollNumber, status, statusDate, feeStructure,
      previousDues, previousDuesFrom, previousDuesTo, previousAnnualFee, annualFeePaid, isFreeship,
      ...personalDetails
    } = req.body;

    const studentId = await generateStudentId(session);

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
      rollNumber: cleanRoll(rollNumber),
      status: status || 'Active',
      statusDate: (status === 'Left' || status === 'Graduated') ? (statusDate ? new Date(statusDate) : new Date()) : undefined,
      isFreeship: parseBoolean(isFreeship),
      feeStructure,
      admissionDate: personalDetails.admissionDate
    });
    await academicRecord.save({ session });

    // Handle previous dues. Recorded even for Freeship students — a waiver stops
    // future challans, it does not erase money already owed.
    const arrearsRecord = buildOpeningArrears({
      challanNo: `ARR-${studentId}-${Date.now()}`,
      student: student._id,
      academicRecord: academicRecord._id,
      campus: currentCampus,
      academicSession: currentSession,
      amount: previousDues,
      from: previousDuesFrom,
      to: previousDuesTo,
      annualAmount: previousAnnualFee,
    });
    if (arrearsRecord) await arrearsRecord.save({ session });

    // Kept as its own record rather than folded into the arrears one above: that
    // record states what is still OWED, and mixing a settled payment into it would
    // let the payment allocation spend this money on the unpaid months instead.
    const paidAnnualRecord = buildPaidAnnualFee({
      challanNo: `ANP-${studentId}-${Date.now()}`,
      student: student._id,
      academicRecord: academicRecord._id,
      campus: currentCampus,
      academicSession: currentSession,
      amount: annualFeePaid,
    });
    if (paidAnnualRecord) await paidAnnualRecord.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Format response
    const result = {
      ...student.toJSON(),
      class: academicRecord.className,
      section: academicRecord.section,
      rollNumber: academicRecord.rollNumber,
      status: academicRecord.status,
      isFreeship: academicRecord.isFreeship,
    };
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
    const { class: cls, section, status, search, gender, freeship, page = 1, limit = 10 } = req.query;

    const matchPipeline = {
      isDeleted: false
    };

    if (currentCampus) matchPipeline.campus = new mongoose.Types.ObjectId(currentCampus);
    if (currentSession) matchPipeline.academicSession = new mongoose.Types.ObjectId(currentSession);
    if (cls) matchPipeline.className = cls;
    if (section) matchPipeline.section = section;
    if (status) matchPipeline.status = status;

    // Freeship filter. Records created before this field existed have no
    // `isFreeship` key at all, so "paying students" must match missing OR false.
    if (freeship === 'yes') matchPipeline.isFreeship = true;
    else if (freeship === 'no') matchPipeline.isFreeship = { $ne: true };

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

    // Escape regex metacharacters so a stray '(' or '+' in the query can't throw.
    if (search && search.trim()) {
      const rx = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { 'studentData.fullName': rx },
            { 'studentData.studentId': rx },
            { 'studentData.fatherName': rx },
            { rollNumber: rx }
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
      status: r.status,
      statusDate: r.statusDate,
      isFreeship: !!r.isFreeship
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
      result.statusDate = current.statusDate;
      result.academicRecordId = current._id;
      result.isFreeship = !!current.isFreeship;

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
        // A Freeship student is billed nothing, so the effective payable is zero
        // regardless of what the class structure says.
        monthlyTotal: current.isFreeship ? 0 : tuitionFee + transportFee + miscFee,
        hasStructure: !!struct,
        hasOverride: !!override,
        isFreeship: !!current.isFreeship,
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
    // previousDues* are admission-time only (they created a one-off arrears
    // challan); strip them so they can never leak into the Student document.
    const {
      class: className, section, rollNumber, status, statusDate, feeStructure, academicRecordId,
      isFreeship, previousDues, previousDuesFrom, previousDuesTo, previousAnnualFee, annualFeePaid,
      ...personalDetails
    } = req.body;

    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: personalDetails },
      { new: true, runValidators: true, session }
    );
    if (!student) throw new Error('Student not found');

    let academicRecord;
    const updatePayload = { className, section, status, feeStructure };
    const unsetPayload = {};

    // Freeship can be granted or revoked at any time during the session.
    if (isFreeship !== undefined) updatePayload.isFreeship = parseBoolean(isFreeship);

    if (rollNumber === '' || rollNumber === null || rollNumber === undefined) {
      unsetPayload.rollNumber = '';
    } else {
      updatePayload.rollNumber = rollNumber;
    }

    // Track the day a student left / graduated. Stamp the date for terminal
    // statuses (using the date supplied by the form, else today), and clear it
    // if the student is set back to Active.
    if (status === 'Left' || status === 'Graduated') {
      updatePayload.statusDate = statusDate ? new Date(statusDate) : new Date();
    } else if (status === 'Active') {
      unsetPayload.statusDate = '';
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
      result.statusDate = academicRecord.statusDate;
      result.isFreeship = !!academicRecord.isFreeship;
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

    // Mark all academic records as Left, stamping the day they were removed
    await StudentAcademicRecord.updateMany(
      { student: student._id, isDeleted: false },
      { $set: { status: 'Left', statusDate: new Date() } },
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

    // The client uploads in batches, so `i` restarts at 0 each request. The
    // offset lets an error name the row as it appears in the user's file.
    const rowOffset = Number(req.body.rowOffset) || 0;

    // Pre-calculate the starting sequence number (max existing suffix + 1),
    // then increment locally for each imported record.
    let nextSeq = await getNextSeqNumber(Student, 'studentId', 'SMS', session);

    for (let i = 0; i < studentsData.length; i++) {
      // +2 = 1-based rows, plus the header row.
      const rowNumber = rowOffset + i + 2;
      // Loose spreadsheet headers ("studentName", "previous dues") are mapped
      // onto schema fields and blank cells dropped before anything is saved.
      const studentObj = normalizeStudentRow(studentsData[i]);
      const {
        class: className, section, rollNumber, status, statusDate, feeStructure,
        previousDues, previousDuesFrom, previousDuesTo, previousAnnualFee, annualFeePaid, isFreeship,
        ...personalDetails
      } = studentObj;

      if (!personalDetails.fullName) {
        throw new Error(
          `Row ${rowNumber}: student name is missing. Check that your file has a name column ` +
          `(e.g. "fullName" or "studentName") and that the row is not empty.`
        );
      }

      const studentId = formatSeqId('SMS', nextSeq++);

      try {
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
          rollNumber: cleanRoll(rollNumber),
          status: status || 'Active',
          statusDate: (status === 'Left' || status === 'Graduated') ? (statusDate ? new Date(statusDate) : new Date()) : undefined,
          isFreeship: parseBoolean(isFreeship),
          feeStructure,
          admissionDate: personalDetails.admissionDate || Date.now()
        });
        await academicRecord.save({ session });

        const arrearsRecord = buildOpeningArrears({
          challanNo: `ARR-${studentId}-${Date.now()}-${i}`,
          student: student._id,
          academicRecord: academicRecord._id,
          campus: currentCampus,
          academicSession: currentSession,
          amount: previousDues,
          from: previousDuesFrom,
          to: previousDuesTo,
          annualAmount: previousAnnualFee,
        });
        if (arrearsRecord) await arrearsRecord.save({ session });

        const paidAnnualRecord = buildPaidAnnualFee({
          challanNo: `ANP-${studentId}-${Date.now()}-${i}`,
          student: student._id,
          academicRecord: academicRecord._id,
          campus: currentCampus,
          academicSession: currentSession,
          amount: annualFeePaid,
        });
        if (paidAnnualRecord) await paidAnnualRecord.save({ session });

        addedStudents.push({
          ...student.toJSON(),
          class: academicRecord.className,
          section: academicRecord.section,
          rollNumber: academicRecord.rollNumber,
          status: academicRecord.status,
          isFreeship: academicRecord.isFreeship,
        });
      } catch (rowErr) {
        // Duplicates keep their 11000 code so the caller can still special-case
        // them; everything else gets the row number folded into the message.
        rowErr.message = `Row ${rowNumber} (${personalDetails.fullName}): ${rowErr.message}`;
        throw rowErr;
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: `${addedStudents.length} students imported successfully`, students: addedStudents });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (err.code === 11000) {
      const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'value';
      return res.status(400).json({ message: `${err.message || 'Duplicate entry'} — duplicate ${field}`, field });
    }
    res.status(400).json({ message: err.message });
  }
};

module.exports = {
  addStudent, getStudents, getStudent, updateStudent, deleteStudent, getClasses, bulkAddStudents,
  // Exported for tests — builds a document, touches no database.
  buildPaidAnnualFee,
};
