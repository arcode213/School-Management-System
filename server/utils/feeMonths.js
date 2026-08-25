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

const shortMonth = (monthName) => {
  if (!monthName) return '';
  const m = monthName.trim().toLowerCase();
  if (m.startsWith('jan')) return 'Jan';
  if (m.startsWith('feb')) return 'Feb';
  if (m.startsWith('mar')) return 'Mar';
  if (m.startsWith('apr')) return 'April'; // Match user's "April"
  if (m.startsWith('may')) return 'May';
  if (m.startsWith('jun')) return 'June';
  if (m.startsWith('jul')) return 'July';
  if (m.startsWith('aug')) return 'Aug';
  if (m.startsWith('sep')) return 'Sept';
  if (m.startsWith('oct')) return 'Oct';
  if (m.startsWith('nov')) return 'Nov';
  if (m.startsWith('dec')) return 'Dec';
  return monthName;
};

const shortYear = (year) => {
  if (!year) return '';
  return String(year).slice(-2);
};

const formatMonthYear = (month, year) => {
  if (!month) return '';
  return `${shortMonth(month)} ${shortYear(year)}`; // Space between month and year!
};

const parseStartYear = (range, fallbackYear) => {
  if (!range) return fallbackYear;
  const m = String(range).match(/^[A-Za-z]+\s*(\d{2}|\d{4})/);
  if (m) {
    const y = Number(m[1]);
    return y < 100 ? 2000 + y : y;
  }
  return fallbackYear;
};

// Build a clean range label, e.g. "April 26" (single month) or "April 25 to Aug 26" (span).
// Year suffix is always included on all month names in the range.
const buildDueMonthRange = (startMonth, startYear, feeMonth, feeYear) => {
  if (!startMonth) {
    return feeYear !== undefined && feeYear !== null ? formatMonthYear(feeMonth, feeYear) : feeMonth;
  }
  if (startYear === undefined || startYear === null || feeYear === undefined || feeYear === null) {
    return startMonth !== feeMonth ? `${startMonth} to ${feeMonth}` : feeMonth;
  }
  const startsSame = startMonth === feeMonth;
  const yearsSame = startYear === feeYear;
  if (startsSame && yearsSame) {
    return formatMonthYear(feeMonth, feeYear);
  }
  return `${formatMonthYear(startMonth, startYear)} to ${formatMonthYear(feeMonth, feeYear)}`;
};

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
// otherwise parseable string, "January 2026" / "Jan 2026" / "Jan-2026", "2026-01", a bare year,
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

  // "January 2026" / "Jan 2026" / "Jan-2026" / "March/2026" / "April 25" / "Apr-25" / "Apr/25"
  const monthYear = text.match(/^([A-Za-z]{3,})[\s\-/,]+(\d{2}|\d{4})$/);
  if (monthYear) {
    const idx = MONTHS.findIndex(m => m.toLowerCase().startsWith(monthYear[1].toLowerCase().substring(0, 3)));
    if (idx >= 0) {
      const rawYear = Number(monthYear[2]);
      const fullYear = rawYear < 100 ? 2000 + rawYear : rawYear;
      return new Date(Date.UTC(fullYear, idx, 1));
    }
  }

  // "25-Jan" / "2025-Jan" / "25/January"
  const yearMonthText = text.match(/^(\d{2}|\d{4})[\s\-/,]+([A-Za-z]{3,})$/);
  if (yearMonthText) {
    const idx = MONTHS.findIndex(m => m.toLowerCase().startsWith(yearMonthText[2].toLowerCase().substring(0, 3)));
    if (idx >= 0) {
      const rawYear = Number(yearMonthText[1]);
      const fullYear = rawYear < 100 ? 2000 + rawYear : rawYear;
      return new Date(Date.UTC(fullYear, idx, 1));
    }
  }

  // "2026-01" / "2026/1" (year-month, no day)
  const yearMonth = text.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonth) {
    const m = Number(yearMonth[2]);
    if (m >= 1 && m <= 12) return new Date(Date.UTC(Number(yearMonth[1]), m - 1, 1));
  }

  // "01-2026" / "01/2026" / "04/25" / "04-25" (month-year, no day)
  const monthYearNum = text.match(/^(\d{1,2})[-/](\d{2}|\d{4})$/);
  if (monthYearNum) {
    const m = Number(monthYearNum[1]);
    if (m >= 1 && m <= 12) {
      const rawYear = Number(monthYearNum[2]);
      const fullYear = rawYear < 100 ? 2000 + rawYear : rawYear;
      return new Date(Date.UTC(fullYear, m - 1, 1));
    }
  }

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
};

// Month/year of a date read in UTC. These inputs are date-only values, so reading
// them in UTC stops "2026-01-01" from sliding into December on a server west of UTC.
const monthYearOf = (date) => ({ month: MONTHS[date.getUTCMonth()], year: date.getUTCFullYear() });

// A cell holding nothing but a month name ("April", "Apr", "june"). Such a value
// carries no year, so parseFlexibleDate rejects it — but it is a perfectly clear
// way to state an arrears period, so buildArrearsPeriod handles it separately.
const monthNameIndex = (value) => {
  if (value === null || value === undefined) return -1;
  const text = String(value).trim();
  if (!/^[A-Za-z]{3,}$/.test(text)) return -1;
  return MONTHS.findIndex(m => m.toLowerCase().startsWith(text.toLowerCase().substring(0, 3)));
};

// Turn a from/to pair into the period an opening arrears challan should carry:
// its (feeMonth, feeYear), the dueMonthRange label, and the exact first/last month
// the amount accounts for. The range is what the parent sees printed as
// "Arrears (January - March)". With nothing usable on either end it falls back to
// the legacy behaviour: stamped with the current month, labelled "Previous Arrears".
const buildArrearsPeriod = (from, to) => {
  const fromDate = parseFlexibleDate(from);
  const toDate = parseFlexibleDate(to);

  // Bare month names are only considered where a real date was not supplied.
  const fromMonthIdx = fromDate ? -1 : monthNameIndex(from);
  const toMonthIdx = toDate ? -1 : monthNameIndex(to);

  if (!fromDate && !toDate && fromMonthIdx < 0 && toMonthIdx < 0) {
    const now = new Date();
    return {
      feeMonth: MONTHS[now.getMonth()],
      feeYear: now.getFullYear(),
      dueMonthRange: 'Previous Arrears',
      startMonth: null,
      endMonth: MONTHS[now.getMonth()],
    };
  }

  // Any bare month name is anchored to the year of whichever end did supply a real
  // date, falling back to the current year when neither did.
  const anchor = toDate || fromDate;
  const anchorYear = anchor ? monthYearOf(anchor).year : new Date().getFullYear();

  const resolve = (date, monthIdx) => {
    if (date) return monthYearOf(date);
    if (monthIdx >= 0) return { month: MONTHS[monthIdx], year: anchorYear };
    return null;
  };

  let start = resolve(fromDate, fromMonthIdx);
  // The range END anchors the record's feeMonth/feeYear, since that is the last
  // month the outstanding amount accounts for. With only a start given, the period
  // is that single month.
  const end = resolve(toDate, toMonthIdx) || start;

  // "November" - "February" written as bare month names means the range wrapped the
  // calendar year, so the start belongs to the year before the end.
  if (start && absMonth(start.month, start.year) > absMonth(end.month, end.year)) {
    start = { month: start.month, year: start.year - 1 };
  }

  return {
    feeMonth: end.month,
    feeYear: end.year,
    dueMonthRange: start ? buildDueMonthRange(start.month, start.year, end.month, end.year) : end.month,
    // The exact months the arrears cover, printed verbatim on the challan instead
    // of being re-derived (and mis-derived) from the range label.
    startMonth: start ? start.month : null,
    endMonth: end.month,
  };
};

// Resolve accurate dueMonthRange dynamically for a fee record.
// If an older challan had its startYear saved as feeYear (e.g. "April 26 to Aug 26")
// even though its large previous dues span back to previous year (April 2025), this computes
// the accurate start year from the dues amount and monthly recurring fee.
const resolveAccurateDueMonthRange = (fee) => {
  if (!fee) return '';
  const range = fee.dueMonthRange;
  if (range === 'Previous Arrears') return 'Previous Arrears';
  const feeMonth = fee.feeMonth;
  const feeYear = Number(fee.feeYear) || new Date().getFullYear();
  const prevDues = Number(fee.previousDues) || 0;
  const recurring = (Number(fee.tuitionFee) || 0) + (Number(fee.transportFee) || 0) + (Number(fee.miscFee) || 0);

  const startMonth = fee.arrearsFromMonth || parseStartMonth(range, feeMonth);
  const startIdx = MONTHS.indexOf(startMonth);
  const feeIdx = MONTHS.indexOf(feeMonth);

  if (startIdx < 0 || feeIdx < 0) return range || `${feeMonth} ${shortYear(feeYear)}`;

  let startYear = parseStartYear(range, null);

  if (prevDues > 0 && recurring > 0) {
    const monthsOfDues = Math.round(prevDues / recurring);
    const hasCurrentMonth = recurring > 0 && ((fee.tuitionFee || 0) + (fee.transportFee || 0) + (fee.miscFee || 0)) > 0;
    const totalMonths = hasCurrentMonth ? monthsOfDues + 1 : monthsOfDues;
    
    if (totalMonths > 1) {
      const currentAbs = absMonth(feeMonth, feeYear);
      const inferredStartAbs = currentAbs - totalMonths + 1;
      const calculatedStartYear = Math.floor(inferredStartAbs / 12);
      
      const spanInSameYear = (feeIdx - startIdx + 1 + 12) % 12 || 12;
      if (totalMonths > spanInSameYear || calculatedStartYear < feeYear) {
        startYear = calculatedStartYear;
      }
    }
  }

  if (!startYear) {
    startYear = startIdx <= feeIdx ? feeYear : feeYear - 1;
  }

  if (startMonth === feeMonth && startYear === feeYear) {
    return `${shortMonth(feeMonth)} ${shortYear(feeYear)}`;
  }

  return `${shortMonth(startMonth)} ${shortYear(startYear)} to ${shortMonth(feeMonth)} ${shortYear(feeYear)}`;
};

module.exports = {
  MONTHS, parseStartMonth, parseStartYear, buildDueMonthRange, absMonth, monthAfter, computePaidUpToMonth,
  parseFlexibleDate, buildArrearsPeriod, monthNameIndex, resolveAccurateDueMonthRange,
};
