// Spreadsheet imports rarely match the template exactly. Headers arrive as
// "studentName", "FatherName" or "previous dues", and the columns a school does
// not track are left blank. Both cases used to fail quietly or badly:
//
//   * Mongoose DROPS unknown paths under the default strict mode, so an unmapped
//     "studentName" column produced a student row with no name at all — the
//     import reported success and the list showed blanks.
//   * A blank cell arrives as '' (sheet_to_json is called with defval: ''), and
//     '' fails to cast to a Date and fails enum validation, aborting the whole
//     batch with a raw "Cast to date failed for value \"\"" message.
//
// This module maps loose headers onto real schema fields, drops blanks so
// optional columns can be left empty, and canonicalises the enum/number/date
// values a spreadsheet tends to hold.

const { parseFlexibleDate } = require('./feeMonths');

// "Previous Dues", "previous_dues" and "previousDues" all collapse to "previousdues".
const canonicalKey = (header) => String(header).replace(/[^a-z0-9]/gi, '').toLowerCase();

const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

// Every field answers to its own name plus the listed aliases.
const buildAliasMap = (fieldAliases) => {
  const map = {};
  for (const [field, aliases] of Object.entries(fieldAliases)) {
    map[canonicalKey(field)] = field;
    for (const alias of aliases) map[canonicalKey(alias)] = field;
  }
  return map;
};

const GENDERS = ['Male', 'Female', 'Other'];
// Single-letter columns are common enough to be worth spelling out.
const GENDER_SHORTHAND = { m: 'Male', f: 'Female', o: 'Other' };

// Match a spreadsheet value against an enum ignoring case and spacing, so
// "admin staff" and "AdminStaff" both reach 'Admin Staff'. An unrecognised value
// is passed through untouched, letting Mongoose raise a clear enum error naming
// the offending value rather than having it silently rewritten.
const matchEnum = (value, allowed) => {
  const key = canonicalKey(value);
  return allowed.find((option) => canonicalKey(option) === key) || value;
};

const STUDENT_ALIASES = {
  fullName: ['name', 'studentName', 'student', 'studentFullName'],
  fatherName: ['father', 'guardianName', 'guardian', 'fatherGuardianName'],
  motherName: ['mother'],
  cast: ['caste'],
  placeOfBirth: ['birthPlace'],
  dateOfBirth: ['dob', 'birthDate'],
  gender: ['sex'],
  religion: [],
  nationality: [],
  motherTongue: [],
  fatherOccupation: ['occupation', 'fatherProfession'],
  cnic: ['bForm', 'bFormNumber', 'studentCnic'],
  fatherCnic: ['fatherNic'],
  admissionDate: ['doa', 'dateOfAdmission'],
  address: ['homeAddress', 'residentialAddress'],
  phone: ['contact', 'mobile', 'phoneNumber', 'contactNumber'],
  fatherContact: ['fatherPhone', 'fatherMobile'],
  motherContact: ['motherPhone', 'motherMobile'],
  emergencyContact: ['emergencyNumber', 'emergencyPhone'],
  lastSchool: ['previousSchool', 'lastSchoolAttended'],
  email: ['emailAddress'],
  photo: [],
  class: ['className', 'grade', 'classGrade'],
  section: ['sec'],
  rollNumber: ['roll', 'rollNo'],
  status: ['studentStatus'],
  statusDate: ['leavingDate', 'dateOfLeaving'],
  isFreeship: ['freeship', 'free'],
  previousDues: ['prevDues', 'dues', 'arrears', 'previousArrears', 'oldDues', 'previousBalance'],
  previousDuesFrom: ['duesFrom', 'arrearsFrom', 'dueFrom', 'from', 'fromMonth', 'previousDuesStart'],
  previousDuesTo: ['duesTo', 'arrearsTo', 'dueTo', 'to', 'toMonth', 'previousDuesEnd'],
  previousAnnualFee: [
    'previousAnnual', 'annualDues', 'previousAnnualDues', 'annualArrears',
    'prevAnnualFee', 'previousAnnualFees',
  ],
  // THIS session's annual fee, already collected before the school started using the
  // system. Deliberately distinct from `previousAnnualFee`, which is annual fee still
  // OWED from an earlier session: this one is settled, prints nowhere, and exists only
  // so the generator knows the student has had their annual fee for the session and
  // must not be charged it again.
  annualFeePaid: [
    'paidAnnualFee', 'annualPaid', 'annualFeeAlreadyPaid', 'annualFeeReceived',
    'annualFeePaidAmount', 'sessionAnnualPaid',
  ],
};

const EMPLOYEE_ALIASES = {
  fullName: ['name', 'employeeName', 'staffName', 'teacherName'],
  fatherName: ['father'],
  cnic: ['nic', 'idCard'],
  dateOfBirth: ['dob', 'birthDate'],
  gender: ['sex'],
  designation: ['post', 'jobTitle', 'role', 'position'],
  department: ['dept'],
  subject: ['subjects'],
  joiningDate: ['doj', 'dateOfJoining', 'joinDate'],
  status: ['employeeStatus'],
  salary: ['basicSalary', 'basicPay', 'monthlySalary'],
  allowances: ['allowance'],
  deductions: ['deduction'],
  phone: ['contact', 'mobile', 'phoneNumber', 'contactNumber'],
  email: ['emailAddress'],
  address: ['homeAddress'],
  qualification: ['education', 'qualifications'],
  experience: ['experienceYears'],
};

const STUDENT_SPEC = {
  aliasMap: buildAliasMap(STUDENT_ALIASES),
  // previousDuesFrom/To stay raw: buildArrearsPeriod() parses them itself and
  // understands "January 2026" / "2026-01" as well as real dates.
  dateFields: ['dateOfBirth', 'admissionDate', 'statusDate'],
  numberFields: ['previousDues', 'previousAnnualFee', 'annualFeePaid'],
  enumFields: {
    gender: GENDERS,
    status: ['Active', 'Left', 'Graduated', 'Failed', 'Promoted'],
  },
};

const EMPLOYEE_SPEC = {
  aliasMap: buildAliasMap(EMPLOYEE_ALIASES),
  dateFields: ['dateOfBirth', 'joiningDate'],
  numberFields: ['salary', 'allowances', 'deductions'],
  enumFields: {
    gender: GENDERS,
    status: ['Active', 'Resigned', 'Terminated'],
    designation: ['Teacher', 'Clerk', 'Peon', 'Guard', 'Principal', 'Admin Staff', 'Other'],
  },
};

const normalizeRow = (row, spec) => {
  const { aliasMap, dateFields, numberFields, enumFields } = spec;
  const out = {};

  for (const [header, rawValue] of Object.entries(row || {})) {
    const field = aliasMap[canonicalKey(header)];
    // Unrecognised columns are discarded. Mongoose would drop them anyway, and
    // ignoring them keeps a stray "isDeleted" or "currentCampus" column in a
    // spreadsheet from reaching the document.
    if (!field) continue;
    // A blank cell means "not provided". Leaving '' in place would fail the Date
    // cast and the enum validators on optional columns.
    if (isBlank(rawValue)) continue;

    let value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;

    if (dateFields.includes(field)) {
      const parsed = parseFlexibleDate(value);
      if (!parsed) continue; // unreadable date -> treat as not provided
      value = parsed;
    } else if (numberFields.includes(field)) {
      // Amounts are often typed with separators or a currency prefix.
      const numeric = Number(String(value).replace(/[^0-9.\-]/g, ''));
      if (!Number.isFinite(numeric)) continue;
      value = numeric;
    } else if (enumFields[field]) {
      if (enumFields[field] === GENDERS) {
        const shorthand = GENDER_SHORTHAND[String(value).trim().toLowerCase()];
        if (shorthand) value = shorthand;
      }
      value = matchEnum(value, enumFields[field]);
    }

    out[field] = value;
  }

  return out;
};

const normalizeStudentRow = (row) => normalizeRow(row, STUDENT_SPEC);
const normalizeEmployeeRow = (row) => normalizeRow(row, EMPLOYEE_SPEC);

module.exports = { normalizeStudentRow, normalizeEmployeeRow, canonicalKey };
