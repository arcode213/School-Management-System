const mongoose = require('mongoose');
const FeeRecord = require('../models/FeeRecord');
const FeeStructure = require('../models/FeeStructure');
const StudentFeeOverride = require('../models/StudentFeeOverride');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');
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

// Split a challan's unpaid annual fee into the part that came from a PRIOR session
// (its `previousAnnualDues`) and the part the challan charged itself.
//
// Money paid against the annual bucket settles the oldest annual dues first, so a
// payment eats into `previousAnnualDues` before it touches this challan's own
// annual fee — the same oldest-first rule the monthly side already uses.
//
// This split is what keeps an unpaid annual fee labelled "Annual Fee" all session
// long: only the `prior` share may ever be re-billed as "Previous Annual Fee".
const splitAnnualOutstanding = (c) => {
  const outstanding = annualOutstanding(c);
  if (outstanding <= 0) return { prior: 0, own: 0 };
  const prior = Math.min(Math.max((c.previousAnnualDues || 0) - (c.annualPaid || 0), 0), outstanding);
  return { prior, own: outstanding - prior };
};

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

  // Three running totals, each of which stays its own line on the printed challan:
  //  - recurring monthly dues,
  //  - annual fee still owed from a session that has ENDED ("Previous Annual Fee"),
  //  - annual fee still owed from THIS session, which is simply this session's
  //    annual fee not yet paid, so it keeps printing as "Annual Fee".
  let totalDue = 0;
  let currentAnnualCarryForward = 0;

  let displayStartMonth = '';
  let globalDisplayStartAbs = Infinity;

  // The LAST month the carried-over dues account for. A challan's unpaid monthly
  // balance covers everything up to and including its own feeMonth, so the latest
  // such feeMonth is where the arrears period ends. Tracked explicitly rather than
  // assumed to be "the month before the one being billed", which is only true when
  // the dues run right up to the current month.
  let displayEndMonth = '';
  let globalDisplayEndAbs = -Infinity;

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

  // The last month a challan's unpaid monthly balance accounts for.
  const trackUnpaidEnd = (challan) => {
    if (monthlyOutstanding(challan) <= 0) return;
    const endAbs = absMonth(challan.feeMonth, challan.feeYear);
    if (endAbs > globalDisplayEndAbs) {
      globalDisplayEndAbs = endAbs;
      displayEndMonth = challan.feeMonth;
    }
  };

  // Prior-session annual dues, keyed by the session they belong to.
  //
  // Monthly dues ADD UP across challans — every month is its own charge. An annual
  // fee does NOT: one session has ONE annual fee, so several open challans of the
  // same session are all restating THE SAME debt (each one inherited it from the
  // last). Adding them would bill it two or three times over.
  //
  // That is why every annual figure below is combined with Math.max instead of a
  // sum: the largest outstanding amount seen for a session IS that session's annual
  // debt, no matter how many challans happen to be restating it.
  const priorAnnualBySession = new Map();
  const notePriorAnnual = (sessionKey, amount) => {
    if (!(amount > 0)) return;
    priorAnnualBySession.set(sessionKey, Math.max(priorAnnualBySession.get(sessionKey) || 0, amount));
  };

  // The prior-session annual debt that a CURRENT-session challan already absorbed
  // into its own `previousAnnualDues` when it was generated.
  let carriedPriorAnnual = 0;

  // Roll over lump-sum dues without calculating gap months
  for (const challan of lumpSumChallans) {
    totalDue += monthlyOutstanding(challan);
    // All of it counts as PREVIOUS annual: these challans either belong to a session
    // that has ended, or are an opening balance — dues brought in at admission/import,
    // which by definition predate this session's own billing.
    //
    // Grouped by session so two genuinely different past sessions each contribute
    // their own annual fee, while several challans of ONE past session contribute it
    // only once.
    notePriorAnnual(challan.academicSession.toString(), annualOutstanding(challan));
    challansToCarryForward.push(challan);

    // For the UI label, track the absolute earliest month across ANY session
    const start = unpaidStartAbs(challan);
    if (start && start.abs < globalDisplayStartAbs) {
      globalDisplayStartAbs = start.abs;
      displayStartMonth = start.month;
    }
    trackUnpaidEnd(challan);
  }

  // Process current session challans
  for (const challan of currentSessionChallans) {
    totalDue += monthlyOutstanding(challan);
    // The annual fee this challan charged is still THIS session's annual fee while it
    // goes unpaid, so it rolls forward onto the new challan's "Annual Fee" line. Only
    // the share it had itself inherited from an earlier session stays "previous".
    //
    // Both halves are combined with Math.max, not added — see the note above
    // `priorAnnualBySession`. A student with April and May both still open is
    // looking at ONE unpaid annual fee restated twice, not two annual fees.
    const annual = splitAnnualOutstanding(challan);
    carriedPriorAnnual = Math.max(carriedPriorAnnual, annual.prior);
    currentAnnualCarryForward = Math.max(currentAnnualCarryForward, annual.own);
    challansToCarryForward.push(challan);

    // Months this challan has already billed (paid or not) must never be re-billed
    // as gaps, so mark its FULL labelled range as covered.
    const feeIdx = MONTHS.indexOf(challan.feeMonth);
    const rangeStart = parseStartMonth(challan.dueMonthRange, challan.feeMonth);
    const rangeStartIdx = MONTHS.indexOf(rangeStart);
    const rangeStartYear = rangeStartIdx <= feeIdx ? challan.feeYear : challan.feeYear - 1;
    const challanFeeAbs = absMonth(challan.feeMonth, challan.feeYear);
    for (let m = absMonth(rangeStart, rangeStartYear); m <= challanFeeAbs; m++) coveredMonths.add(m);

    trackUnpaidEnd(challan);

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

    // Billing a skipped month extends the arrears period up to the month before the
    // one being generated now.
    if (gapMonths > 0 && currentAbs - 1 > globalDisplayEndAbs) {
      globalDisplayEndAbs = currentAbs - 1;
      displayEndMonth = MONTHS[((currentAbs - 1) % 12 + 12) % 12];
    }
  }

  // Guard against a malformed legacy range whose recorded start sits after its end.
  if (displayStartMonth && displayEndMonth && globalDisplayStartAbs > globalDisplayEndAbs) {
    displayEndMonth = displayStartMonth;
  }

  // Prior-session annual dues reach us by two routes: still-open challans of the past
  // sessions themselves, and the amount a current-session challan already folded into
  // its `previousAnnualDues`. In a healthy carry-forward chain only ONE of those is
  // ever non-zero — once a past challan is rolled forward it is flagged and stops
  // being read. They are combined with max rather than added so that a chain broken
  // by a deleted challan restates the debt instead of doubling it.
  const lumpSumAnnual = [...priorAnnualBySession.values()].reduce((sum, v) => sum + v, 0);
  const totalAnnualDue = Math.max(lumpSumAnnual, carriedPriorAnnual);

  return {
    previousDues: totalDue,
    previousAnnualDues: totalAnnualDue,
    currentAnnualCarryForward,
    startMonth: displayStartMonth,
    endMonth: displayEndMonth,
    gapMonths,
    challansToCarryForward,
  };
};

// The months to stamp on a new challan as the period its arrears cover. Recorded
// only when there IS a monthly arrears amount — an annual-only carry-over belongs
// to no month, and a challan with nothing carried over has no arrears line at all.
const arrearsPeriod = (previousDues, startMonth, endMonth) => {
  if (!(previousDues > 0) || !startMonth) return { from: undefined, to: undefined };
  return { from: startMonth, to: endMonth || startMonth };
};

// Returns a Map of studentId -> the annual fee AMOUNT established for this academic
// session, holding an entry only for students who have already been charged it.
//
// The annual fee is a ONCE-PER-SESSION charge. A student who received it on an
// earlier challan (typically an individual one issued mid-session) must not be
// charged it a second time when the whole class is billed months later.
//
// The amount is read from the EARLIEST challan of the session that charged the fee
// FRESH — `annualFee` minus the share it merely inherited from the challan before
// it. That first charge is, by definition, this session's annual fee, so it doubles
// as a ceiling: any later challan claiming a larger annual amount is restating the
// same debt more than once, and `resolveAnnualForChallan` clamps it back down rather
// than passing the inflation on to the next challan.
//
// Matching on `annualFee > 0` covers the whole carry-forward chain: a rolled-over
// annual fee keeps sitting on `annualFee` (that is what keeps it printing as
// "Annual Fee" all session long), so every challan descended from the original
// charge still identifies the student. `previousAnnualDues` is deliberately NOT
// considered — that is a PRIOR session's annual fee, or an opening balance brought
// in at admission, and neither has any bearing on whether THIS session's annual fee
// has been charged yet.
const findSessionAnnualCharges = async (studentIds, currentSession, session) => {
  const charged = await FeeRecord.find({
    student: { $in: studentIds },
    academicSession: currentSession,
    isDeleted: false,
    annualFee: { $gt: 0 },
  })
    .select('student annualFee annualCarriedForward')
    .sort({ createdAt: 1 })
    .session(session);

  const established = new Map();
  for (const c of charged) {
    const key = c.student.toString();
    if (established.has(key)) continue; // earliest challan wins
    const fresh = Math.max((c.annualFee || 0) - (c.annualCarriedForward || 0), 0);
    // A pure roll-over as the earliest record means its parent was deleted; fall back
    // to the whole amount rather than recording a ceiling of zero.
    established.set(key, fresh > 0 ? fresh : (c.annualFee || 0));
  }
  return established;
};

// A per-student override is "set" only when it holds a real number. An explicit 0 IS
// an override — a student the school has excused the annual fee for — so it must be
// honoured rather than treated as "nothing configured".
const overrideValue = (value) =>
  value === undefined || value === null || Number.isNaN(Number(value)) ? null : Math.max(Number(value), 0);

// How much annual fee to charge a given student, most specific source winning:
//
//   1. their per-student annual fee override, if one is set
//   2. the amount sent with this request (the Generate screen pre-fills it from the
//      class fee structure, and the user may edit it before generating)
//   3. the class fee structure's annual fee
//
// This mirrors the precedence the monthly fees already use, so an "Annual Fee" set in
// Fee Management is picked up automatically and never has to be typed per student.
const resolveAnnualAmount = (studentOverride, classStructure, requestedAmount) => {
  const custom = overrideValue(studentOverride && studentOverride.customAnnualFee);
  if (custom !== null) return custom;
  if (requestedAmount > 0) return requestedAmount;
  return Math.max(Number(classStructure && classStructure.annualFee) || 0, 0);
};

// The annual fee to put on a challan being generated now.
//
// `established` is undefined when this session has not charged the student the annual
// fee yet — only then is a NEW charge added. Otherwise the challan restates whatever
// that one charge still owes, capped by the charge itself. This is what makes the fee
// payable exactly once per session: it can be carried forward indefinitely, but the
// amount can never grow past what was originally billed.
const resolveAnnualForChallan = (established, requestedCharge, carriedForward) => {
  if (established === undefined) {
    return { annualFee: requestedCharge + carriedForward, annualCarriedForward: carriedForward, suppressed: false };
  }
  const carried = Math.min(carriedForward, established);
  return { annualFee: carried, annualCarriedForward: carried, suppressed: requestedCharge > 0 };
};

// Short, human-readable challan number: MONTH - SEQUENCE, e.g. "APR-001".
//
// Seven characters, which is the point — this is read aloud, written on receipts and
// typed into the search box all day. The old format spelled out the campus and the
// year ("SCH-2026-0001") and neither earned its space: the challan already records
// which campus and session it belongs to, and every screen is filtered to one campus
// anyway, so repeating that in the number told staff nothing they did not know.
//
// JAN, FEB, MAR ... — the first three letters are distinct for all twelve months.
const challanPrefix = (feeMonth) => String(feeMonth || '').substring(0, 3).toUpperCase() || 'GEN';

// The counter runs per month and NEVER resets: April 2026 runs APR-001 up to APR-350,
// and April 2027 carries on at APR-351. That is what keeps the number this short while
// still satisfying the unique index on `challanNo` — restarting each year would make
// 2027's APR-001 collide with 2026's.
//
// One sequence covers all campuses, so numbers interleave between them rather than
// each campus counting from 001. That is the price of dropping the campus letter; the
// numbers stay unique, and a challan's campus is still recorded on the record itself.
const generateChallanNo = async (feeMonth, session) => {
  const prefix = challanPrefix(feeMonth);

  // Highest sequence issued so far for this month. Read as the MAX numeric suffix
  // rather than "the most recently created challan": creation order is not sequence
  // order once records are edited or back-dated, and two challans saved in the same
  // millisecond made the old `sort({ createdAt: -1 })` a coin flip.
  //
  // Soft-deleted challans are deliberately still counted, so a deleted number is
  // never handed out a second time.
  const query = FeeRecord.aggregate([
    { $match: { challanNo: { $regex: `^${prefix}-\\d+$` } } },
    { $project: { seq: { $toInt: { $arrayElemAt: [{ $split: ['$challanNo', '-'] }, -1] } } } },
    { $sort: { seq: -1 } },
    { $limit: 1 },
  ]);
  if (session) query.session(session);
  const [top] = await query;

  const seq = (top?.seq || 0) + 1;
  // padStart only pads — once a month passes 999 the number simply grows to 1000.
  return `${prefix}-${String(seq).padStart(3, '0')}`;
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
      tuitionFee, examFee, transportFee, miscFee, annualFee, chargeAnnualFee,
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

    // Check for duplicates.
    //
    // Opening-balance records are deliberately EXCLUDED. They are a statement of what
    // was owed or settled before the school started using the system, not a challan
    // the school issued — they are never printed, and the printing screen filters them
    // out. Both kinds are stamped with the CURRENT month when no period is supplied
    // (an `ANP-` already-paid annual fee always is), so counting them here made an
    // imported student look like they had already been billed for this month and
    // silently blocked their first real challan.
    const exists = await FeeRecord.findOne({
      student, feeMonth, feeYear, isDeleted: false, isOpeningBalance: { $ne: true },
    }).session(session);
    if (exists) throw badRequest(`Challan for ${feeMonth} ${feeYear} already exists for this student.`);

    // Resolve the annual fee the same way the class batch does, so an amount set in
    // Fee Management is picked up automatically here too and never has to be typed:
    // the student's own annual fee override wins, then the amount sent with the
    // request, then their class fee structure.
    const requestedAnnual = Math.max(Number(annualFee) || 0, 0);
    const chargeAnnual = chargeAnnualFee === undefined ? requestedAnnual > 0 : !!chargeAnnualFee;

    let annualRequested = 0;
    if (chargeAnnual) {
      const [classStructure, studentOverride] = await Promise.all([
        FeeStructure.findOne({
          campus: currentCampus, academicSession: currentSession, className: academicRecord.className,
        }).session(session),
        StudentFeeOverride.findOne({
          student, campus: currentCampus, academicSession: currentSession, isActive: true,
        }).session(session),
      ]);
      annualRequested = resolveAnnualAmount(studentOverride, classStructure, requestedAnnual);
    }

    // The annual fee is charged once per session. If this student already carries it
    // on another challan of this session, the requested amount is dropped rather than
    // the whole challan being rejected — everything else on it is still owed, and
    // whatever the annual fee still owes keeps carrying forward untouched.
    const annualCharges = await findSessionAnnualCharges([student], currentSession, session);
    const establishedAnnual = annualCharges.get(String(student));

    // Handle Previous Dues. For a manually-entered challan we treat the current
    // month's recurring charges (tuition + transport + misc) as the per-month
    // rate used to bill any skipped months.
    // The annual fee is deliberately excluded from the recurring rate — it is a
    // one-off, so it must not be used to price skipped months.
    const monthlyRecurring = (tuitionFee || 0) + (transportFee || 0) + (miscFee || 0);
    const { previousDues, previousAnnualDues, currentAnnualCarryForward, startMonth, endMonth, challansToCarryForward } =
      await getPreviousDues(student, currentSession, session, feeMonth, Number(feeYear), monthlyRecurring);
    const dueMonthRange = buildDueMonthRange(startMonth, feeMonth);
    const arrears = arrearsPeriod(previousDues, startMonth, endMonth);

    // Unpaid annual fee from an earlier challan of this same session joins the annual
    // fee charged here, so the parent keeps seeing one "Annual Fee" line for the
    // session's annual fee instead of it being relabelled "Previous Annual Fee".
    const annual = resolveAnnualForChallan(establishedAnnual, annualRequested, currentAnnualCarryForward);
    const annualSuppressed = annual.suppressed;

    const challanNo = await generateChallanNo(feeMonth, session);

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
      annualFee: annual.annualFee,
      annualCarriedForward: annual.annualCarriedForward,
      previousDues,
      previousAnnualDues,
      arrearsFromMonth: arrears.from,
      arrearsToMonth: arrears.to,
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

    // Say so when the annual fee was dropped, or a silently smaller total looks
    // like the challan simply ignored what was ticked.
    const payload = fee.toJSON();
    if (annualSuppressed) {
      payload.annualSuppressed = true;
      payload.notice =
        'Challan generated. The annual fee was not added again — this student was already charged it earlier this session.';
    }

    res.status(201).json(payload);
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

    // The annual fee is opt-in per run. `chargeAnnualFee` is the switch; `annualFee`
    // is only the amount the Generate screen pre-filled from the class fee structure,
    // and each student's real amount is resolved below (an override can beat it).
    //
    // The flag has to be separate from the amount: a batch where every student takes
    // their annual fee from a fee structure or an override sends no amount at all, and
    // the old "amount > 0 means charge it" test would have skipped the whole batch.
    // Requests without the flag fall back to that old test so nothing already
    // integrated against this endpoint breaks.
    const { class: studentClass, section, feeMonth, feeYear, dueDate, annualFee, chargeAnnualFee } = req.body;
    const requestedAnnual = Math.max(Number(annualFee) || 0, 0);
    const chargeAnnual = chargeAnnualFee === undefined ? requestedAnnual > 0 : !!chargeAnnualFee;

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

    // Students in this batch who already carry this session's annual fee — from an
    // individual challan issued earlier in the year, or an earlier batch that also
    // had the box ticked — mapped to the amount that was charged. They keep whatever
    // they already owe; the batch's annual fee is added only to the rest. Resolved in
    // ONE query up front rather than per student inside the loop.
    //
    // Always resolved, even when this batch is not charging an annual fee, because
    // the recorded amount also caps what may be carried forward.
    const annualCharges = await findSessionAnnualCharges(
      academicRecords.map(r => r.student), currentSession, session
    );

    let createdCount = 0;
    let skippedFreeship = 0;
    let skippedExisting = 0;
    let skippedAnnual = 0;

    for (const record of academicRecords) {
      // Freeship students pay nothing, so they never receive a challan.
      if (record.isFreeship) {
        skippedFreeship++;
        continue;
      }

      // Skip if already generated. Opening-balance records do NOT count as a challan
      // for the month they are stamped with — see the note in addFee.
      const exists = await FeeRecord.findOne({
        student: record.student,
        feeMonth,
        feeYear,
        academicSession: currentSession,
        isDeleted: false,
        isOpeningBalance: { $ne: true }
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
      const { previousDues, previousAnnualDues, currentAnnualCarryForward, startMonth, endMonth, challansToCarryForward } =
        await getPreviousDues(record.student, currentSession, session, feeMonth, Number(feeYear), monthlyRecurring);
      const dueMonthRange = buildDueMonthRange(startMonth, feeMonth);
      const arrears = arrearsPeriod(previousDues, startMonth, endMonth);

      // This session's own unpaid annual fee stays on the "Annual Fee" line (see the
      // note in addFee); only a prior session's lands in previousAnnualDues.
      //
      // The batch's annual fee is added only to students who have not been charged it
      // yet this session. For everyone else the line still shows whatever their annual
      // fee still owes — carried forward, not re-charged — so a student who paid it on
      // an individual challan gets no annual line at all.
      // Each student's own amount: their annual fee override if they have one,
      // otherwise the amount sent with the batch, otherwise their class fee structure.
      const studentAnnual = chargeAnnual ? resolveAnnualAmount(stuOverride, baseStruct, requestedAnnual) : 0;

      const studentKey = record.student.toString();
      const annual = resolveAnnualForChallan(
        annualCharges.get(studentKey), studentAnnual, currentAnnualCarryForward
      );
      if (annual.suppressed) skippedAnnual++;
      // Guard the case of a student holding two academic records in this session:
      // once this batch charges them, the second record must not charge them again.
      if (studentAnnual > 0 && !annualCharges.has(studentKey)) annualCharges.set(studentKey, studentAnnual);

      const challanNo = await generateChallanNo(feeMonth, session);

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
        annualFee: annual.annualFee,
        annualCarriedForward: annual.annualCarriedForward,
        previousDues,
        previousAnnualDues,
        arrearsFromMonth: arrears.from,
        arrearsToMonth: arrears.to,
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

    // Report what was skipped so a smaller-than-expected batch — or a challan whose
    // annual fee is missing — is never a mystery.
    const notes = [];
    if (skippedFreeship > 0) notes.push(`${skippedFreeship} skipped (Freeship)`);
    if (skippedExisting > 0) notes.push(`${skippedExisting} already had a challan`);
    if (skippedAnnual > 0) notes.push(`${skippedAnnual} not re-charged the annual fee (already charged this session)`);

    await session.commitTransaction();
    session.endSession();
    res.status(201).json({
      message: `Successfully generated ${createdCount} challans${notes.length ? ` — ${notes.join(', ')}` : ''}.`,
      created: createdCount,
      skippedFreeship,
      skippedExisting,
      skippedAnnual,
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
    const {
      feeMonth, feeYear, status, class: studentClass, challanNo, search,
      excludeOpening, page = 1, limit = 15,
    } = req.query;

    const matchStage = { isDeleted: false };
    // Opening balances are a record of dues brought in at admission/import, not a
    // challan the school issued — the printing screen asks for them to be left out.
    if (excludeOpening === 'true') matchStage.isOpeningBalance = { $ne: true };
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
    // How much of that total is earmarked for the annual fee (see the FeeRecord
    // pre-save allocation rule). Sent as a running total, like amountPaid.
    if (req.body.annualPaid !== undefined) fee.annualPaid = Number(req.body.annualPaid) || 0;
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
    if (req.body.annualFee !== undefined) {
      fee.annualFee = req.body.annualFee;
      // `annualCarriedForward` is the roll-over share OF `annualFee`, so it can never
      // exceed it. Editing the annual fee down (or to zero) must take the recorded
      // share down with it, or the record would claim to have carried more than it
      // now charges.
      fee.annualCarriedForward = Math.min(fee.annualCarriedForward || 0, Math.max(Number(fee.annualFee) || 0, 0));
    }
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

    // Zeroing the arrears out by hand must take the printed period with it, or the
    // challan keeps claiming months it no longer bills for.
    if (!(fee.previousDues > 0)) {
      fee.arrearsFromMonth = undefined;
      fee.arrearsToMonth = undefined;
    }

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
  addFee, addBulkFees, getFees, getStudentFees, getDues, updateFee, deleteFee, getFee,
  // Exported for tests — pure helpers with no database access.
  challanPrefix, resolveAnnualForChallan, resolveAnnualAmount,
};
