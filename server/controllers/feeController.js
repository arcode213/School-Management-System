const mongoose = require('mongoose');
const FeeRecord = require('../models/FeeRecord');
const FeeStructure = require('../models/FeeStructure');
const StudentFeeOverride = require('../models/StudentFeeOverride');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');
const Campus = require('../models/Campus');
const { MONTHS, parseStartMonth, buildDueMonthRange, absMonth, monthAfter } = require('../utils/feeMonths');

// Client errors carry a statusCode so the handler can answer 400 instead of a
// blanket 500 — the UI surfaces these messages verbatim to the user.
const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });

// The first still-unpaid month of a challan. When some months have already been
// paid (paidUpToMonth set), the outstanding balance begins the month after; the
// remainder of the range falls back to the labelled start month.
const outstandingStartMonth = (challan) =>
  challan.paidUpToMonth ? monthAfter(challan.paidUpToMonth) : parseStartMonth(challan.dueMonthRange, challan.feeMonth);

// Outstanding per bucket. Challans written before the annual-fee split existed have
// no monthlyBalance/annualBalance, so fall back to treating the whole balance as
// monthly — which is exactly what it was.
const monthlyOutstanding = (c) =>
  c.monthlyBalance === undefined || c.monthlyBalance === null ? c.balance : c.monthlyBalance;
const annualOutstanding = (c) =>
  c.annualBalance === undefined || c.annualBalance === null ? 0 : c.annualBalance;

// Helper to calculate previous dues
// `currentFeeMonth`/`currentFeeYear` describe the challan being generated now, and
// `monthlyRecurring` is the recurring per-month charge (tuition + transport + misc)
// used to bill any skipped months that never received a challan of their own.
const getPreviousDues = async (studentId, currentSession, session, currentFeeMonth, currentFeeYear, monthlyRecurring = 0) => {
  // Find the most recent active challan that is NOT fully paid and has NOT been carried forward across ALL sessions
  const allOldChallans = await FeeRecord.find({
    student: studentId,
    isDeleted: false,
    hasBeenCarriedForward: false,
    status: { $in: ['Unpaid', 'Partial', 'Overdue'] }
  }).session(session);

  // Two running totals: recurring monthly dues and unpaid annual fee. They stay
  // separate all the way onto the printed challan.
  let totalDue = 0;
  let totalAnnualDue = 0;

  let displayStartMonth = '';
  let globalDisplayStartAbs = Infinity;

  let currentSessionStartMonth = '';
  let globalCurrentSessionStartAbs = Infinity;

  // Every month that an existing unpaid challan in the current session already accounts for.
  const coveredMonths = new Set();
  
  const currentSessionId = currentSession.toString();

  // A challan rolls over as a flat lump sum — no skipped-month analysis — when it
  // belongs to an earlier session, OR when it is an imported/admission opening
  // balance. An opening balance already states the FULL amount owed for its month
  // range, so billing extra "gap" months on top of it would charge the same period
  // twice.
  const isLumpSum = (c) => c.isOpeningBalance || c.academicSession.toString() !== currentSessionId;
  const lumpSumChallans = allOldChallans.filter(isLumpSum);
  const currentSessionChallans = allOldChallans.filter(c => !isLumpSum(c));

  const challansToCarryForward = [];

  // The earliest still-unpaid MONTH a challan contributes, as an absolute month
  // number. Returns null when the challan's monthly side is fully settled — only an
  // annual balance can remain then, and an annual fee belongs to no month, so it
  // must not drag the printed arrears range backwards.
  const unpaidStartAbs = (challan) => {
    if (monthlyOutstanding(challan) <= 0) return null;
    const feeIdx = MONTHS.indexOf(challan.feeMonth);
    const candidate = outstandingStartMonth(challan);
    const candidateIdx = MONTHS.indexOf(candidate);
    // If the range wraps the calendar year ("December - January"), the start month
    // belongs to the previous calendar year.
    const startYear = candidateIdx <= feeIdx ? challan.feeYear : challan.feeYear - 1;
    return { abs: absMonth(candidate, startYear), month: candidate };
  };

  // Roll over lump-sum dues without calculating gap months
  for (const challan of lumpSumChallans) {
    totalDue += monthlyOutstanding(challan);
    totalAnnualDue += annualOutstanding(challan);
    challansToCarryForward.push(challan);

    // For the UI label, track the absolute earliest month across ANY session
    const start = unpaidStartAbs(challan);
    if (start && start.abs < globalDisplayStartAbs) {
      globalDisplayStartAbs = start.abs;
      displayStartMonth = start.month;
    }
  }

  // Process current session challans
  for (const challan of currentSessionChallans) {
    totalDue += monthlyOutstanding(challan);
    totalAnnualDue += annualOutstanding(challan);
    challansToCarryForward.push(challan);

    // Months this challan has already billed (paid or not) must never be re-billed
    // as gaps, so mark its FULL labelled range as covered.
    const feeIdx = MONTHS.indexOf(challan.feeMonth);
    const rangeStart = parseStartMonth(challan.dueMonthRange, challan.feeMonth);
    const rangeStartIdx = MONTHS.indexOf(rangeStart);
    const rangeStartYear = rangeStartIdx <= feeIdx ? challan.feeYear : challan.feeYear - 1;
    const challanFeeAbs = absMonth(challan.feeMonth, challan.feeYear);
    for (let m = absMonth(rangeStart, rangeStartYear); m <= challanFeeAbs; m++) coveredMonths.add(m);

    const start = unpaidStartAbs(challan);
    if (!start) continue;

    // Track for gap month calculation (strictly within current session)
    if (start.abs < globalCurrentSessionStartAbs) {
      globalCurrentSessionStartAbs = start.abs;
      currentSessionStartMonth = start.month;
    }

    // Also track for the UI label
    if (start.abs < globalDisplayStartAbs) {
      globalDisplayStartAbs = start.abs;
      displayStartMonth = start.month;
    }
  }

  // Bill any months that were skipped between the oldest unpaid month and the
  // current month IN THE CURRENT SESSION.
  let gapMonths = 0;
  if (currentSessionChallans.length > 0 && currentFeeMonth && globalCurrentSessionStartAbs !== Infinity) {
    const currentAbs = absMonth(currentFeeMonth, currentFeeYear);
    for (let m = globalCurrentSessionStartAbs; m < currentAbs; m++) {
      if (!coveredMonths.has(m)) gapMonths++;
    }
    // Skipped months are recurring monthly charges, so they land in the monthly bucket.
    totalDue += gapMonths * (monthlyRecurring || 0);
  }

  return {
    previousDues: totalDue,
    previousAnnualDues: totalAnnualDue,
    startMonth: displayStartMonth,
    gapMonths,
    challansToCarryForward,
  };
};

// Helper to generate unique challan number
const generateChallanNo = async (campusId, year, session) => {
  const campus = await Campus.findById(campusId).session(session);
  // Strip non-alphanumerics so a campus name like "Al-Falah" can't inject a stray
  // dash into the challan number (which previously broke the sequence parsing).
  const cleanName = campus && campus.name ? campus.name.replace(/[^a-zA-Z0-9]/g, '') : '';
  const prefix = cleanName ? cleanName.substring(0, 3).toUpperCase() : 'SCH';

  // Find latest challan for this campus and year
  const latest = await FeeRecord.findOne({ challanNo: new RegExp(`^${prefix}-${year}-`) })
    .sort({ createdAt: -1 })
    .session(session);

  let seq = 1;
  if (latest) {
    // The sequence is always the LAST dash-separated segment. Reading it
    // positionally (parts[2]) broke whenever the prefix or year contained a dash.
    const lastSeg = latest.challanNo.split('-').pop();
    const parsed = parseInt(lastSeg, 10);
    if (!isNaN(parsed)) seq = parsed + 1;
  }

  return `${prefix}-${year}-${seq.toString().padStart(4, '0')}`;
};

// @desc    Record a single fee payment
// @route   POST /api/fees
const addFee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus || !currentSession) {
      throw badRequest('Campus and Academic Session context are required');
    }

    const {
      student, studentAcademicRecord, feeMonth, feeYear, dueDate,
      tuitionFee, examFee, transportFee, miscFee, annualFee,
    } = req.body;

    // Always load the academic record — it is needed both to link the challan and
    // to check the Freeship waiver below.
    const academicRecord = studentAcademicRecord
      ? await StudentAcademicRecord.findById(studentAcademicRecord).session(session)
      : await StudentAcademicRecord.findOne({ student, academicSession: currentSession, campus: currentCampus }).session(session);

    if (!academicRecord) throw badRequest('No active academic record found for student in current session');
    if (academicRecord.isFreeship) {
      throw badRequest('This student is on Freeship — their fees are waived, so no challan can be generated.');
    }
    const academicRecordId = academicRecord._id;

    // Check for duplicates
    const exists = await FeeRecord.findOne({ student, feeMonth, feeYear, isDeleted: false }).session(session);
    if (exists) throw badRequest(`Challan for ${feeMonth} ${feeYear} already exists for this student.`);

    // Handle Previous Dues. For a manually-entered challan we treat the current
    // month's recurring charges (tuition + transport + misc) as the per-month
    // rate used to bill any skipped months.
    // The annual fee is deliberately excluded from the recurring rate — it is a
    // one-off, so it must not be used to price skipped months.
    const monthlyRecurring = (tuitionFee || 0) + (transportFee || 0) + (miscFee || 0);
    const { previousDues, previousAnnualDues, startMonth, challansToCarryForward } =
      await getPreviousDues(student, currentSession, session, feeMonth, Number(feeYear), monthlyRecurring);
    const dueMonthRange = buildDueMonthRange(startMonth, feeMonth);

    const challanNo = await generateChallanNo(currentCampus, feeYear, session);

    const fee = new FeeRecord({
      challanNo,
      student,
      studentAcademicRecord: academicRecordId,
      campus: currentCampus,
      academicSession: currentSession,
      feeMonth,
      feeYear,
      dueMonthRange,
      tuitionFee: tuitionFee || 0,
      examFee: examFee || 0,
      transportFee: transportFee || 0,
      miscFee: miscFee || 0,
      annualFee: annualFee || 0,
      previousDues,
      previousAnnualDues,
      dueDate: dueDate || new Date(new Date().setDate(new Date().getDate() + 10)) // Default +10 days
    });

    await fee.save({ session });
    
    if (challansToCarryForward && challansToCarryForward.length > 0) {
      for (const oldChallan of challansToCarryForward) {
        oldChallan.hasBeenCarriedForward = true;
        oldChallan.carriedForwardTo = fee._id;
        await oldChallan.save({ session });
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(201).json(fee);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (err.code === 11000) return res.status(400).json({ message: 'Duplicate Challan Number generated.' });
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

// @desc    Bulk post fees for a class
// @route   POST /api/fees/bulk
const addBulkFees = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { currentCampus, currentSession } = req;
    if (!currentCampus || !currentSession) {
      throw badRequest('Campus and Academic Session context are required');
    }

    // `annualFee` is opt-in per run: the Generate modal only sends an amount when the
    // "also charge annual fee" box is ticked, so any month's batch can include it.
    const { class: studentClass, section, feeMonth, feeYear, dueDate, annualFee } = req.body;
    const annualCharge = Number(annualFee) > 0 ? Number(annualFee) : 0;
    
    const filter = { 
      campus: currentCampus, 
      academicSession: currentSession, 
      isDeleted: false, 
      status: 'Active' 
    };
    if (studentClass) filter.className = studentClass;
    if (section) filter.section = section;

    const academicRecords = await StudentAcademicRecord.find(filter).session(session);
    if (academicRecords.length === 0) {
      throw badRequest('No active students found in this criteria.');
    }

    // Fetch class fee structures
    const feeStructures = await FeeStructure.find({ campus: currentCampus, academicSession: currentSession }).session(session);
    const structMap = {};
    feeStructures.forEach(s => structMap[s.className] = s);

    // Fetch student overrides
    const overrides = await StudentFeeOverride.find({ campus: currentCampus, academicSession: currentSession, isActive: true }).session(session);
    const overrideMap = {};
    overrides.forEach(o => overrideMap[o.student.toString()] = o);

    let createdCount = 0;
    let skippedFreeship = 0;
    let skippedExisting = 0;

    for (const record of academicRecords) {
      // Freeship students pay nothing, so they never receive a challan.
      if (record.isFreeship) {
        skippedFreeship++;
        continue;
      }

      // Skip if already generated
      const exists = await FeeRecord.findOne({
        student: record.student,
        feeMonth,
        feeYear,
        academicSession: currentSession,
        isDeleted: false
      }).session(session);

      if (exists) {
        skippedExisting++;
        continue;
      }

      const baseStruct = structMap[record.className];
      const stuOverride = overrideMap[record.student.toString()];

      let tFee = 0, tTrans = 0, tMisc = 0;
      if (baseStruct) {
        tFee = baseStruct.tuitionFee;
        tTrans = baseStruct.transportFee;
        tMisc = baseStruct.miscFee;
      }
      
      // Apply override if exists
      if (stuOverride) {
        if (stuOverride.customTuitionFee !== undefined && stuOverride.customTuitionFee !== null) tFee = stuOverride.customTuitionFee;
        if (stuOverride.customTransportFee !== undefined && stuOverride.customTransportFee !== null) tTrans = stuOverride.customTransportFee;
        if (stuOverride.customMiscFee !== undefined && stuOverride.customMiscFee !== null) tMisc = stuOverride.customMiscFee;
      }

      // Calculate previous dues and carry forward. Skipped months are billed at
      // the recurring monthly rate (tuition + transport + misc) for this student.
      const monthlyRecurring = tFee + tTrans + tMisc;
      const { previousDues, previousAnnualDues, startMonth, challansToCarryForward } =
        await getPreviousDues(record.student, currentSession, session, feeMonth, Number(feeYear), monthlyRecurring);
      const dueMonthRange = buildDueMonthRange(startMonth, feeMonth);

      const challanNo = await generateChallanNo(currentCampus, feeYear, session);

      const fee = new FeeRecord({
        challanNo,
        student: record.student,
        studentAcademicRecord: record._id,
        campus: currentCampus,
        academicSession: currentSession,
        feeMonth,
        feeYear,
        dueMonthRange,
        tuitionFee: tFee,
        examFee: 0,
        transportFee: tTrans,
        miscFee: tMisc,
        annualFee: annualCharge,
        previousDues,
        previousAnnualDues,
        dueDate: dueDate || new Date(new Date().setDate(new Date().getDate() + 10))
      });

      await fee.save({ session });

      if (challansToCarryForward && challansToCarryForward.length > 0) {
        for (const oldChallan of challansToCarryForward) {
          oldChallan.hasBeenCarriedForward = true;
          oldChallan.carriedForwardTo = fee._id;
          await oldChallan.save({ session });
        }
      }
      createdCount++;
    }

    if (createdCount === 0) {
      if (skippedFreeship > 0 && skippedExisting === 0) {
        throw badRequest(`No challans generated — all ${skippedFreeship} matching student(s) are on Freeship (fees waived).`);
      }
      throw badRequest('Fees already posted for all students in this criteria.');
    }

    // Report what was skipped so a smaller-than-expected batch is never a mystery.
    const notes = [];
    if (skippedFreeship > 0) notes.push(`${skippedFreeship} skipped (Freeship)`);
    if (skippedExisting > 0) notes.push(`${skippedExisting} already had a challan`);

    await session.commitTransaction();
    session.endSession();
    res.status(201).json({
      message: `Successfully generated ${createdCount} challans${notes.length ? ` — ${notes.join(', ')}` : ''}.`,
      created: createdCount,
      skippedFreeship,
      skippedExisting,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

// @desc    Get all fee records
// @route   GET /api/fees
const getFees = async (req, res) => {
  try {
    const { currentCampus, currentSession } = req;
    const { feeMonth, feeYear, status, class: studentClass, challanNo, search, page = 1, limit = 15 } = req.query;

    const matchStage = { isDeleted: false };
    if (currentCampus) matchStage.campus = new mongoose.Types.ObjectId(currentCampus);
    if (currentSession) matchStage.academicSession = new mongoose.Types.ObjectId(currentSession);
    if (feeMonth) matchStage.feeMonth = feeMonth;
    if (feeYear) matchStage.feeYear = Number(feeYear);
    if (status) matchStage.status = status;
    if (challanNo) matchStage.challanNo = { $regex: challanNo, $options: 'i' };

    const pipeline = [
      { $match: matchStage },
      { $lookup: { from: 'studentacademicrecords', localField: 'studentAcademicRecord', foreignField: '_id', as: 'academicInfo' } },
      { $unwind: { path: '$academicInfo', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'students', localField: 'student', foreignField: '_id', as: 'studentInfo' } },
      { $unwind: { path: '$studentInfo', preserveNullAndEmptyArrays: true } }
    ];

    if (studentClass) {
      pipeline.push({ $match: { 'academicInfo.className': studentClass } });
    }

    // Universal search across challan + joined student/class fields. Escape regex
    // metacharacters so a stray '(' or '+' in the query can't throw.
    if (search && search.trim()) {
      const safe = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = { $regex: safe, $options: 'i' };
      pipeline.push({
        $match: {
          $or: [
            { challanNo: rx },
            { dueMonthRange: rx },
            { 'studentInfo.fullName': rx },
            { 'studentInfo.fatherName': rx },
            { 'studentInfo.studentId': rx },
            { 'studentInfo.phone': rx },
            { 'academicInfo.className': rx },
            { 'academicInfo.section': rx },
            { 'academicInfo.rollNumber': rx },
          ],
        },
      });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await FeeRecord.aggregate(countPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: (Number(page) - 1) * Number(limit) });
    pipeline.push({ $limit: Number(limit) });

    const fees = await FeeRecord.aggregate(pipeline);

    const formatted = fees.map(f => {
      if (f.studentInfo) {
        f.studentInfo.class = f.academicInfo?.className || '';
        f.studentInfo.section = f.academicInfo?.section || '';
        f.studentInfo.rollNumber = f.academicInfo?.rollNumber || '';
        // Surfaced so the UI can exclude Freeship students from challan printing.
        f.studentInfo.isFreeship = !!f.academicInfo?.isFreeship;
      }
      return f;
    });

    res.json({
      fees: formatted,
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
    const { currentSession } = req;
    const filter = { student: req.params.id, isDeleted: false };
    if (currentSession) filter.academicSession = currentSession;

    const fees = await FeeRecord.find(filter)
      .populate('academicSession', 'name')
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
    const { currentCampus, currentSession } = req;
    // VERY IMPORTANT: Do NOT fetch challans that have been carried forward.
    const filter = { isDeleted: false, hasBeenCarriedForward: false, status: { $in: ['Unpaid', 'Partial', 'Overdue'] } };
    if (currentCampus) filter.campus = currentCampus;
    if (currentSession) filter.academicSession = currentSession;

    const dues = await FeeRecord.find(filter)
      .populate('student', 'fullName fatherName studentId phone')
      .populate('studentAcademicRecord', 'className section isFreeship')
      .sort({ feeYear: 1, createdAt: 1 });
      
    const formatted = dues.map(d => {
      const doc = d.toJSON();
      if (doc.student) {
        doc.student.class = doc.studentAcademicRecord?.className;
        doc.student.section = doc.studentAcademicRecord?.section;
      }
      return doc;
    });
      
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update a fee record (Payment)
// @route   PUT /api/fees/:id
const updateFee = async (req, res) => {
  try {
    const fee = await FeeRecord.findOne({ _id: req.params.id, isDeleted: false });
    if (!fee) return res.status(404).json({ message: 'Fee record not found' });

    // Payment fields
    if (req.body.amountPaid !== undefined) fee.amountPaid = req.body.amountPaid;
    if (req.body.paymentMethod) fee.paymentMethod = req.body.paymentMethod;
    if (req.body.paymentDate) fee.paymentDate = req.body.paymentDate;
    if (req.body.remarks !== undefined) fee.remarks = req.body.remarks;
    if (req.body.discount !== undefined) fee.discount = req.body.discount;
    if (req.body.lateFine !== undefined) fee.lateFine = req.body.lateFine;

    // Challan charge fields (edit mode)
    if (req.body.tuitionFee !== undefined) fee.tuitionFee = req.body.tuitionFee;
    if (req.body.examFee !== undefined) fee.examFee = req.body.examFee;
    if (req.body.transportFee !== undefined) fee.transportFee = req.body.transportFee;
    if (req.body.miscFee !== undefined) fee.miscFee = req.body.miscFee;
    if (req.body.annualFee !== undefined) fee.annualFee = req.body.annualFee;
    if (req.body.previousDues !== undefined) fee.previousDues = req.body.previousDues;
    if (req.body.previousAnnualDues !== undefined) fee.previousAnnualDues = req.body.previousAnnualDues;
    if (req.body.dueDate) fee.dueDate = req.body.dueDate;
    if (req.body.feeMonth) {
      // A multi-month range ("April - June") comes from carried-forward dues and
      // must survive an edit — only its END month moves. The previous guard tested
      // for ' to ', but buildDueMonthRange emits ' - ', so it never matched and
      // every edit silently flattened the range to a single month (which then threw
      // off the printed arrears label and the paidUpToMonth split).
      const startMonth = parseStartMonth(fee.dueMonthRange, fee.feeMonth);
      const isSpan = !!fee.dueMonthRange && startMonth !== fee.feeMonth;

      fee.feeMonth = req.body.feeMonth;
      fee.dueMonthRange = isSpan ? buildDueMonthRange(startMonth, req.body.feeMonth) : req.body.feeMonth;
    }
    if (req.body.feeYear) fee.feeYear = Number(req.body.feeYear);

    await fee.save(); // triggers pre-save hook for status & balance

    res.json(fee);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete fee record
// @route   DELETE /api/fees/:id
const deleteFee = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const fee = await FeeRecord.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true, session }
    );
    if (!fee) throw new Error('Fee record not found');

    // Reset any older challans that were carried forward into this deleted challan
    await FeeRecord.updateMany(
      { carriedForwardTo: fee._id },
      { $set: { hasBeenCarriedForward: false, carriedForwardTo: null } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    res.json({ message: 'Fee record deleted' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    const status = err.message === 'Fee record not found' ? 404 : 500;
    res.status(status).json({ message: err.message });
  }
};

// @desc    Get single fee record by ID
// @route   GET /api/fees/:id
const getFee = async (req, res) => {
  try {
    const fee = await FeeRecord.findOne({ _id: req.params.id, isDeleted: false })
      .populate('student', 'fullName studentId fatherName phone address')
      .populate('studentAcademicRecord', 'className section rollNumber isFreeship')
      .populate('campus', 'name phone address principalName code'); // make sure code exists if needed

    if (!fee) return res.status(404).json({ message: 'Fee record not found' });

    const doc = fee.toJSON();
    if (doc.student) {
      doc.student.class = doc.studentAcademicRecord?.className;
      doc.student.section = doc.studentAcademicRecord?.section;
      doc.student.rollNumber = doc.studentAcademicRecord?.rollNumber;
      doc.student.isFreeship = !!doc.studentAcademicRecord?.isFreeship;
    }
    
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  addFee, addBulkFees, getFees, getStudentFees, getDues, updateFee, deleteFee, getFee
};
