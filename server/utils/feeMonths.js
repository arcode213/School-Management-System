// Shared month/range helpers for fee challans. Used by both the FeeRecord model
// (pre-save) and the fee controller so the logic can never drift between them.

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Extract the earliest (start) month from a challan's dueMonthRange string.
// Handles "April", "April - June", "April to June" and legacy "April, May" / "April & May".
const parseStartMonth = (range, fallback) => {
  if (!range) return fallback;
  const first = String(range).split(' to ')[0].split(/[-,&]/)[0].trim();
  const match = MONTHS.find(m => m.toLowerCase().startsWith(first.toLowerCase().substring(0, 3)));
  return match || fallback;
};

// Build a clean range label, e.g. "April" (single month) or "April - June" (span).
const buildDueMonthRange = (startMonth, feeMonth) =>
  startMonth && startMonth !== feeMonth ? `${startMonth} - ${feeMonth}` : feeMonth;

// Absolute month number so months can be compared/ranged across calendar-year
// boundaries (e.g. an academic session running December -> January).
const absMonth = (monthName, year) => Number(year) * 12 + MONTHS.indexOf(monthName);

// The month immediately after the given one (wraps December -> January).
const monthAfter = (monthName) => MONTHS[(MONTHS.indexOf(monthName) + 1) % 12];

// Given a saved fee record, infer the LAST month fully covered by payments so
// far. The recurring monthly rate is tuition + transport + misc, and a challan
// spans [rangeStart .. feeMonth]. Returns null when less than a full month has
// been paid (or the monthly rate is unknown), and feeMonth when fully paid.
//
// `monthlyPaid` is the share of the payment allocated to the MONTHLY bucket (see
// the FeeRecord pre-save hook). Annual-fee money must be excluded or it would
// inflate the month count. Falls back to amountPaid when not supplied.
const computePaidUpToMonth = (fee, monthlyPaid) => {
  if (!fee) return null;
  const paid = monthlyPaid === undefined || monthlyPaid === null ? fee.amountPaid : monthlyPaid;
  if (!paid || paid <= 0) return null;
  if (fee.balance <= 0) return fee.feeMonth; // fully settled

  const recurring = (fee.tuitionFee || 0) + (fee.transportFee || 0) + (fee.miscFee || 0);
  if (recurring <= 0) return null;

  const startIdx = MONTHS.indexOf(parseStartMonth(fee.dueMonthRange, fee.feeMonth));
  const feeIdx = MONTHS.indexOf(fee.feeMonth);
  if (startIdx < 0 || feeIdx < 0) return null;

  let span = feeIdx - startIdx;
  if (span < 0) span += 12; // range wrapped the calendar year
  const totalMonths = span + 1;

  const monthsPaid = Math.floor(paid / recurring);
  if (monthsPaid < 1) return null;
  if (monthsPaid >= totalMonths) return fee.feeMonth;
  return MONTHS[(startIdx + monthsPaid - 1) % 12];
};

// ─── Opening-arrears period helpers ────────────────────────────────────────────
// Used when a student is admitted or imported with a pre-existing balance and the
// school records the months that balance covers.

// Excel stores dates as a day count from 1899-12-30 (its epoch, offset for the
// 1900 leap-year bug).
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

// Tolerant date parser for form + spreadsheet input. Accepts a Date, an ISO or
// otherwise parseable string, "January 2026" / "Jan-2026", "2026-01", a bare year,
// or a raw Excel serial number. Returns null when nothing sensible is present.
const parseFlexibleDate = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const text = String(value).trim();
  if (!text) return null;

  // Purely numeric -> either a year or an Excel serial date.
  if (/^\d+(\.\d+)?$/.test(text)) {
    const n = Number(text);
    if (n >= 1900 && n <= 2999) return new Date(Date.UTC(n, 0, 1)); // a bare year
    if (n > 0 && n < 100000) return new Date(EXCEL_EPOCH_MS + n * MS_PER_DAY);
    return null;
  }

  // "January 2026" / "Jan 2026" / "Jan-2026" / "March/2026"
  const monthYear = text.match(/^([A-Za-z]{3,})[\s\-/,]+(\d{4})$/);
  if (monthYear) {
    const idx = MONTHS.findIndex(m => m.toLowerCase().startsWith(monthYear[1].toLowerCase().substring(0, 3)));
    if (idx >= 0) return new Date(Date.UTC(Number(monthYear[2]), idx, 1));
  }

  // "2026-01" / "2026/1" (year-month, no day)
  const yearMonth = text.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonth) {
    const m = Number(yearMonth[2]);
    if (m >= 1 && m <= 12) return new Date(Date.UTC(Number(yearMonth[1]), m - 1, 1));
  }

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// Month/year of a date read in UTC. These inputs are date-only values, so reading
// them in UTC stops "2026-01-01" from sliding into December on a server west of UTC.
const monthYearOf = (date) => ({ month: MONTHS[date.getUTCMonth()], year: date.getUTCFullYear() });

// Turn a from/to date pair into the (feeMonth, feeYear, dueMonthRange) an opening
// arrears challan should carry. The range is what the parent sees printed as
// "Arrears (January - March)". With no usable dates it falls back to the legacy
// behaviour: stamped with the current month and labelled "Previous Arrears".
const buildArrearsPeriod = (from, to) => {
  const fromDate = parseFlexibleDate(from);
  const toDate = parseFlexibleDate(to);

  // The range END anchors the record's feeMonth/feeYear, since that is the last
  // month the outstanding amount accounts for.
  const end = toDate || fromDate;
  if (!end) {
    const now = new Date();
    return { feeMonth: MONTHS[now.getMonth()], feeYear: now.getFullYear(), dueMonthRange: 'Previous Arrears' };
  }

  const { month: endMonth, year: endYear } = monthYearOf(end);
  const start = fromDate ? monthYearOf(fromDate) : null;

  return {
    feeMonth: endMonth,
    feeYear: endYear,
    dueMonthRange: start ? buildDueMonthRange(start.month, endMonth) : endMonth,
  };
};

module.exports = {
  MONTHS, parseStartMonth, buildDueMonthRange, absMonth, monthAfter, computePaidUpToMonth,
  parseFlexibleDate, buildArrearsPeriod,
};
