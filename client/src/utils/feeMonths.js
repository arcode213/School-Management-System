// Month helpers for the fee UI. Mirrors the server's range parsing so the
// payment modal can reason about which months a challan covers.

export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Earliest month named in a dueMonthRange string ("April - June" -> "April").
export const parseStartMonth = (range, fallback) => {
  if (!range) return fallback;
  const first = String(range).split(' to ')[0].split(/[-,&]/)[0].trim();
  const match = MONTHS.find(m => m.toLowerCase().startsWith(first.toLowerCase().substring(0, 3)));
  return match || fallback;
};

// Month name at an absolute index, wrapping across the year.
export const monthAt = (i) => MONTHS[(((i % 12) + 12) % 12)];
