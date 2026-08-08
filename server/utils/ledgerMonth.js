/**
 * The accounts ledger runs on calendar months in Pakistan Standard Time.
 *
 * WHY THIS FILE EXISTS
 * Dates are stored as UTC instants. An expense entered at 00:30 on 1 September in
 * Karachi is 19:30 on 31 August in UTC, so grouping by the raw UTC month files it
 * under the wrong month — and once a month is closed, a misfiled row either
 * cannot be edited or silently changes a finalised total. Every month boundary in
 * the module therefore comes from here.
 *
 * TWO MECHANISMS, ONE ANSWER
 * Aggregations pass `timezone: TIMEZONE` to `$dateToString` / `$dateTrunc`, which
 * uses MongoDB's own tz database. JavaScript-side boundary maths uses the fixed
 * +05:00 offset below. These agree because Pakistan has observed no daylight
 * saving since 2009, so PKT is a constant UTC+5. If that ever changes, this file
 * is the single place that has to learn about it.
 */

const TIMEZONE = 'Asia/Karachi';

// PKT is UTC+5 year-round (no DST). Minutes, to match Date's own units.
const OFFSET_MINUTES = 5 * 60;
const OFFSET_MS = OFFSET_MINUTES * 60 * 1000;

/** A ledger month key: 'YYYY-MM'. */
const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const isMonthKey = (value) => typeof value === 'string' && MONTH_KEY_RE.test(value);

/**
 * The ledger month a given instant falls in, read in Karachi local time.
 * `new Date('2026-08-31T19:30:00Z')` → '2026-09'.
 */
const ledgerMonthOf = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 7);
};

/** The current ledger month. */
const currentMonthKey = () => ledgerMonthOf(new Date());

/** '2026-08' → { year: 2026, month: 8 } (month is 1-based). */
const partsOf = (monthKey) => {
  if (!isMonthKey(monthKey)) return null;
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
};

/** { year, month (1-based) } → '2026-08'. */
const monthKeyOf = (year, month) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;

/**
 * The UTC instants bounding a Karachi calendar month, as a half-open interval:
 * `{ $gte: start, $lt: end }`. Half-open rather than `$lte` on the last
 * millisecond, so a payment timestamped exactly at midnight cannot fall in two
 * months or in neither.
 */
const monthRange = (monthKey) => {
  const parts = partsOf(monthKey);
  if (!parts) return null;
  const { year, month } = parts;
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - OFFSET_MS),
    end: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - OFFSET_MS),
  };
};

/** Step a month key. `shiftMonth('2026-01', -1)` → '2025-12'. */
const shiftMonth = (monthKey, delta) => {
  const parts = partsOf(monthKey);
  if (!parts) return null;
  // Date.UTC normalises overflow in both directions, so December → January and
  // January → December need no special case.
  const d = new Date(Date.UTC(parts.year, parts.month - 1 + delta, 1));
  return monthKeyOf(d.getUTCFullYear(), d.getUTCMonth() + 1);
};

const previousMonth = (monthKey) => shiftMonth(monthKey, -1);
const nextMonth = (monthKey) => shiftMonth(monthKey, 1);

/** Inclusive list of month keys from `from` to `to`. Empty if the range is backwards. */
const monthsBetween = (from, to) => {
  if (!isMonthKey(from) || !isMonthKey(to) || from > to) return [];
  const out = [];
  for (let key = from; key <= to; key = nextMonth(key)) out.push(key);
  return out;
};

/** The twelve month keys of a calendar year, oldest first. */
const monthsOfYear = (year) =>
  Array.from({ length: 12 }, (_, i) => monthKeyOf(year, i + 1));

/**
 * Reusable aggregation expression for "which ledger month is this date in".
 * Use inside `$group: { _id: monthKeyExpr('$date') }`.
 */
const monthKeyExpr = (dateField) => ({
  $dateToString: { format: '%Y-%m', date: dateField, timezone: TIMEZONE },
});

/** 'YYYY-MM' → 'August 2026', for report headings and slips. */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const formatMonthKey = (monthKey) => {
  const parts = partsOf(monthKey);
  return parts ? `${MONTH_NAMES[parts.month - 1]} ${parts.year}` : String(monthKey ?? '');
};

/** 'August', 2026 → '2026-08'. Bridges the existing name+year fee/salary fields. */
const monthKeyFromName = (monthName, year) => {
  const idx = MONTH_NAMES.indexOf(monthName);
  if (idx === -1 || !year) return null;
  return monthKeyOf(Number(year), idx + 1);
};

module.exports = {
  TIMEZONE,
  OFFSET_MINUTES,
  MONTH_KEY_RE,
  MONTH_NAMES,
  isMonthKey,
  ledgerMonthOf,
  currentMonthKey,
  partsOf,
  monthKeyOf,
  monthRange,
  shiftMonth,
  previousMonth,
  nextMonth,
  monthsBetween,
  monthsOfYear,
  monthKeyExpr,
  formatMonthKey,
  monthKeyFromName,
};
