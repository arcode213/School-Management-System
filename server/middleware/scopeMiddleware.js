const FeeRecord = require('../models/FeeRecord');
const Employee = require('../models/Employee');
const StudentAcademicRecord = require('../models/StudentAcademicRecord');

/**
 * Campus and session scoping for routes that address a single record by id.
 *
 * List endpoints filter by `req.currentCampus` / `req.currentSession`, which
 * `protect` has already clamped to what the account is allowed — so a restricted
 * user cannot browse outside their scope. Fetching by id skips that filter
 * entirely, so without these guards a scoped user who knew (or guessed) an id
 * could read or edit a record from a campus, or an academic year, they were
 * never given.
 *
 * Session matters as much as campus: an account kept to the current year must not
 * be able to open last year's challan — that is the whole point of restricting
 * it. Records that carry no session (an employee, say) are judged on campus only.
 *
 * Out-of-scope records answer 404, not 403: to an account that may not see a
 * campus, its records do not exist, and a 403 would confirm the id is real.
 */

const outOfScope = (allowed, value) => {
  if (!allowed || allowed.length === 0) return false; // unrestricted
  if (!value) return false;                           // nothing to judge against
  return !allowed.includes(value.toString());
};

const isScoped = (req) => (req.allowedCampuses?.length > 0) || (req.allowedSessions?.length > 0);

const notFound = (res, label) => res.status(404).json({ message: `${label} not found` });

// FeeRecord and Employee both carry their scope on the document itself.
const restrictByOwnScope = (Model, label) => async (req, res, next) => {
  try {
    if (!isScoped(req)) return next();

    const doc = await Model.findById(req.params.id).select('campus academicSession');
    if (!doc) return notFound(res, label);

    if (outOfScope(req.allowedCampuses, doc.campus)) return notFound(res, label);
    if (outOfScope(req.allowedSessions, doc.academicSession)) return notFound(res, label);

    next();
  } catch (err) {
    next(err);
  }
};

// A Student holds no scope of its own — enrolment lives on its academic records,
// and a student may have several across campuses and sessions. The student is
// visible if any single enrolment is one this account may see: it must match on
// BOTH campus and session, or a clerk kept to this year could reach a student
// they only ever taught last year.
const restrictStudentToScope = async (req, res, next) => {
  try {
    if (!isScoped(req)) return next();

    const records = await StudentAcademicRecord.find({ student: req.params.id, isDeleted: false })
      .select('campus academicSession');

    // No academic record yet (a freshly imported student) — nothing to judge
    // against, so let the controller handle it rather than hiding the record.
    if (records.length === 0) return next();

    const visible = records.some(r =>
      !outOfScope(req.allowedCampuses, r.campus) &&
      !outOfScope(req.allowedSessions, r.academicSession)
    );
    if (!visible) return notFound(res, 'Student');

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  restrictFeeToScope: restrictByOwnScope(FeeRecord, 'Fee record'),
  restrictEmployeeToScope: restrictByOwnScope(Employee, 'Employee'),
  restrictStudentToScope,
};
