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
const computePaidUpToMonth = (fee) => {
  if (!fee || !fee.amountPaid || fee.amountPaid <= 0) return null;
  if (fee.balance <= 0) return fee.feeMonth; // fully settled

  const recurring = (fee.tuitionFee || 0) + (fee.transportFee || 0) + (fee.miscFee || 0);
  if (recurring <= 0) return null;

  const startIdx = MONTHS.indexOf(parseStartMonth(fee.dueMonthRange, fee.feeMonth));
  const feeIdx = MONTHS.indexOf(fee.feeMonth);
  if (startIdx < 0 || feeIdx < 0) return null;

  let span = feeIdx - startIdx;
  if (span < 0) span += 12; // range wrapped the calendar year
  const totalMonths = span + 1;

  const monthsPaid = Math.floor(fee.amountPaid / recurring);
  if (monthsPaid < 1) return null;
  if (monthsPaid >= totalMonths) return fee.feeMonth;
  return MONTHS[(startIdx + monthsPaid - 1) % 12];
};

module.exports = { MONTHS, parseStartMonth, buildDueMonthRange, absMonth, monthAfter, computePaidUpToMonth };
