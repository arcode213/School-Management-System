const ClosedMonth = require('../models/ClosedMonth');
const { ledgerMonthOf, formatMonthKey } = require('./ledgerMonth');

/**
 * The write-lock on a finalised month.
 *
 * Closing a month is only meaningful if it actually stops writes. The subtle part
 * is WHICH month a write belongs to: it is the month of the record's own date,
 * not the month the person happens to be doing the typing in. Recording a
 * September expense dated 20 August has to be refused if August is closed, and
 * moving an existing August expense's date into September has to be refused
 * twice — once for leaving a closed month and once for the month it lands in.
 *
 * Everything here answers with a plain `{ message }` in the shape the client
 * already surfaces, and a 409 Conflict — the request was well-formed, it just
 * cannot be honoured in the books' current state.
 */

class MonthClosedError extends Error {
  constructor(monthKey) {
    super(
      `${formatMonthKey(monthKey)} has been closed, so its records can no longer be changed. ` +
      `Reopen the month from the Accounts ledger if this needs correcting.`
    );
    this.statusCode = 409;
    this.monthKey = monthKey;
  }
}

/** Is this campus's given ledger month currently closed? */
const isMonthClosed = async (campusId, monthKey, session = null) => {
  if (!campusId || !monthKey) return false;
  const query = ClosedMonth.findOne({ campus: campusId, month: monthKey, isClosed: true }).select('_id');
  if (session) query.session(session);
  return Boolean(await query.lean());
};

/**
 * Throws if any of the supplied dates falls in a closed month.
 *
 * Pass BOTH the old and the new date when editing, so a record can neither be
 * moved out of a closed month nor into one.
 */
const assertMonthsOpen = async (campusId, dates, session = null) => {
  const keys = [...new Set(
    (Array.isArray(dates) ? dates : [dates])
      .filter(Boolean)
      .map((d) => ledgerMonthOf(d))
      .filter(Boolean)
  )];

  for (const key of keys) {
    if (await isMonthClosed(campusId, key, session)) throw new MonthClosedError(key);
  }
};

/**
 * Express guard for routes whose body carries a date.
 *
 * Only useful for creates — an edit has to compare against the record's existing
 * date too, which needs a database read the controller is already doing, so those
 * call `assertMonthsOpen` directly.
 */
const requireOpenMonth = (dateField = 'date') => async (req, res, next) => {
  try {
    const value = req.body?.[dateField];
    await assertMonthsOpen(req.currentCampus, value ? [value] : [new Date()]);
    next();
  } catch (err) {
    if (err instanceof MonthClosedError) {
      return res.status(err.statusCode).json({ message: err.message, month: err.monthKey });
    }
    next(err);
  }
};

/** The set of closed months for a campus, for greying out a picker. */
const closedMonthsFor = async (campusId) => {
  if (!campusId) return [];
  const rows = await ClosedMonth.find({ campus: campusId, isClosed: true }).select('month').lean();
  return rows.map((r) => r.month);
};

module.exports = {
  MonthClosedError,
  isMonthClosed,
  assertMonthsOpen,
  requireOpenMonth,
  closedMonthsFor,
};
