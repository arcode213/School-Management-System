/**
 * Money formatting.
 *
 * Amounts are stored as plain rupee numbers on the server (see the accounts
 * module), so formatting is purely a display concern and never changes a value
 * that is about to be sent back.
 *
 * `en-PK` groups the way the school reads figures. Decimals are dropped unless
 * the amount actually has them — a ledger of whole rupees should not be a wall of
 * ".00".
 */

const nf = (min, max) =>
  new Intl.NumberFormat('en-PK', { minimumFractionDigits: min, maximumFractionDigits: max });

const hasPaisa = (n) => Math.abs(Number(n) - Math.trunc(Number(n))) > 0.004;

/** `Rs. 1,42,900` — the standard ledger figure. */
export const fmtPKR = (value) => {
  const n = Number(value) || 0;
  return `Rs. ${nf(hasPaisa(n) ? 2 : 0, 2).format(n)}`;
};

/** Same, but a negative reads as `-Rs. 500` rather than `Rs. -500`. */
export const fmtSignedPKR = (value) => {
  const n = Number(value) || 0;
  return `${n < 0 ? '-' : ''}${fmtPKR(Math.abs(n))}`;
};

/** Bare grouped number, for table cells that already sit under a "Rs." heading. */
export const fmtNumber = (value) => {
  const n = Number(value) || 0;
  return nf(hasPaisa(n) ? 2 : 0, 2).format(n);
};

/** Compact, for chart axes where `Rs. 1,42,900` will not fit. */
export const fmtCompact = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
};

// ─── Ledger months ───────────────────────────────────────────────────────────
// The client mirrors the server's month-key handling so a picker and a request
// agree on what "this month" means. The server is the authority; these are for
// building the controls.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'YYYY-MM' for today, read in the browser's local time. */
export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** '2026-08' → 'August 2026'. */
export const formatMonthKey = (key) => {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return key || '';
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

/** '2026-08' → '2026-07'. Negative deltas step backwards. */
export const shiftMonthKey = (key, delta) => {
  if (!key) return key;
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** The last `count` months, newest first — for a month dropdown. */
export const recentMonths = (count = 18, from = currentMonthKey()) =>
  Array.from({ length: count }, (_, i) => shiftMonthKey(from, -i));

/** The twelve month keys of a calendar year. */
export const monthsOfYear = (year) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

export { MONTH_NAMES };
