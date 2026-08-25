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

export const shortMonth = (monthName) => {
  if (!monthName) return '';
  const m = monthName.trim().toLowerCase();
  if (m.startsWith('jan')) return 'Jan';
  if (m.startsWith('feb')) return 'Feb';
  if (m.startsWith('mar')) return 'Mar';
  if (m.startsWith('apr')) return 'April';
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

export const shortYear = (year) => {
  if (!year) return '';
  return String(year).slice(-2);
};

export const formatMonthYear = (month, year) => {
  if (!month) return '';
  return `${shortMonth(month)} ${shortYear(year)}`;
};

export const absMonth = (monthName, year) => Number(year) * 12 + MONTHS.indexOf(monthName);
export const monthAfter = (monthName) => MONTHS[(MONTHS.indexOf(monthName) + 1) % 12];

export const parseStartYear = (range, fallbackYear) => {
  if (!range) return fallbackYear;
  const m = String(range).match(/^[A-Za-z]+\s*(\d{2}|\d{4})/);
  if (m) {
    const y = Number(m[1]);
    return y < 100 ? 2000 + y : y;
  }
  return fallbackYear;
};

export const parseDueMonthRange = (range, fallbackMonth, fallbackYear) => {
  if (!range) return { startMonth: fallbackMonth, startYear: fallbackYear, endMonth: fallbackMonth, endYear: fallbackYear };
  
  const toFullYear = (y, fallback) => {
    if (!y) return fallback;
    const n = Number(y);
    return n < 100 ? 2000 + n : n;
  };

  // 1. Match span with years on both sides: "April 25 to Aug 26", "April 2025 to August 2026", "Aug25-Aug26"
  const spanWithYears = range.match(/^([A-Za-z]+)\s*(\d{2}|\d{4})\s*(?:to|-)\s*([A-Za-z]+)\s*(\d{2}|\d{4})$/i);
  if (spanWithYears) {
    const fullStartMonth = MONTHS.find(m => m.toLowerCase().startsWith(spanWithYears[1].toLowerCase().substring(0, 3)));
    const fullEndMonth = MONTHS.find(m => m.toLowerCase().startsWith(spanWithYears[3].toLowerCase().substring(0, 3)));
    const startYear = toFullYear(spanWithYears[2], fallbackYear);
    const endYear = toFullYear(spanWithYears[4], fallbackYear);
    return {
      startMonth: fullStartMonth || fallbackMonth,
      startYear,
      endMonth: fullEndMonth || fallbackMonth,
      endYear
    };
  }

  // 2. Match span with year on the end only: "April - August 2025", "April to August 25"
  const spanEndYear = range.match(/^([A-Za-z]+)\s*(?:to|-)\s*([A-Za-z]+)\s*(\d{2}|\d{4})$/i);
  if (spanEndYear) {
    const fullStartMonth = MONTHS.find(m => m.toLowerCase().startsWith(spanEndYear[1].toLowerCase().substring(0, 3)));
    const fullEndMonth = MONTHS.find(m => m.toLowerCase().startsWith(spanEndYear[2].toLowerCase().substring(0, 3)));
    const endYear = toFullYear(spanEndYear[3], fallbackYear);
    const startIdx = MONTHS.indexOf(fullStartMonth);
    const endIdx = MONTHS.indexOf(fullEndMonth);
    const startYear = (startIdx > endIdx) ? endYear - 1 : endYear;
    return {
      startMonth: fullStartMonth || fallbackMonth,
      startYear,
      endMonth: fullEndMonth || fallbackMonth,
      endYear
    };
  }

  // 3. Match span with year on start only: "April 2025 to August", "April 25 to August"
  const spanStartYear = range.match(/^([A-Za-z]+)\s*(\d{2}|\d{4})\s*(?:to|-)\s*([A-Za-z]+)$/i);
  if (spanStartYear) {
    const fullStartMonth = MONTHS.find(m => m.toLowerCase().startsWith(spanStartYear[1].toLowerCase().substring(0, 3)));
    const fullEndMonth = MONTHS.find(m => m.toLowerCase().startsWith(spanStartYear[3].toLowerCase().substring(0, 3)));
    const startYear = toFullYear(spanStartYear[2], fallbackYear);
    const startIdx = MONTHS.indexOf(fullStartMonth);
    const endIdx = MONTHS.indexOf(fullEndMonth);
    const endYear = fallbackYear || ((startIdx > endIdx) ? startYear + 1 : startYear);
    return {
      startMonth: fullStartMonth || fallbackMonth,
      startYear,
      endMonth: fullEndMonth || fallbackMonth,
      endYear
    };
  }

  // 4. Legacy span without years: "August - October" or "August to October"
  const legacySpan = range.match(/^([A-Za-z]+)\s*(?:to|-)\s*([A-Za-z]+)$/i);
  if (legacySpan) {
    const fullStartMonth = MONTHS.find(m => m.toLowerCase().startsWith(legacySpan[1].toLowerCase().substring(0, 3)));
    const fullEndMonth = MONTHS.find(m => m.toLowerCase().startsWith(legacySpan[2].toLowerCase().substring(0, 3)));
    const startIdx = MONTHS.indexOf(fullStartMonth);
    const endIdx = MONTHS.indexOf(fullEndMonth);
    const startYear = (startIdx > endIdx) ? fallbackYear - 1 : fallbackYear;
    return {
      startMonth: fullStartMonth || fallbackMonth,
      startYear,
      endMonth: fullEndMonth || fallbackMonth,
      endYear: fallbackYear
    };
  }

  // 5. Single month with year: "Aug 26", "August 26", "August 2026", "April 25", "April 2025"
  const singleWithYear = range.match(/^([A-Za-z]+)\s*(\d{2}|\d{4})$/);
  if (singleWithYear) {
    const fullMonth = MONTHS.find(m => m.toLowerCase().startsWith(singleWithYear[1].toLowerCase().substring(0, 3)));
    const year = toFullYear(singleWithYear[2], fallbackYear);
    return {
      startMonth: fullMonth || fallbackMonth,
      startYear: year,
      endMonth: fullMonth || fallbackMonth,
      endYear: year
    };
  }

  // 6. Fallback for single month without year: "August"
  return {
    startMonth: fallbackMonth,
    startYear: fallbackYear,
    endMonth: fallbackMonth,
    endYear: fallbackYear
  };
};

export const resolveAccurateDueMonthRange = (fee) => {
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

export const formatDueMonths = (range, feeMonth, feeYear, feeRecord = null) => {
  if (feeRecord && typeof feeRecord === 'object') {
    return resolveAccurateDueMonthRange(feeRecord);
  }

  if (!range) return formatMonthYear(feeMonth, feeYear);
  if (range === 'Previous Arrears') return 'Previous Arrears';

  const toFullYear = (y, fallback) => {
    if (!y) return fallback;
    const n = Number(y);
    return n < 100 ? 2000 + n : n;
  };

  // 1. Match span with years on both sides: "April 25 to Aug 26", "April 2025 to August 2026", "Aug25-Aug26"
  const spanWithYears = range.match(/^([A-Za-z]+)\s*(\d{2}|\d{4})\s*(?:to|-)\s*([A-Za-z]+)\s*(\d{2}|\d{4})$/i);
  if (spanWithYears) {
    const startM = spanWithYears[1];
    const startY = toFullYear(spanWithYears[2], feeYear);
    const endM = spanWithYears[3];
    const endY = toFullYear(spanWithYears[4], feeYear);
    return `${shortMonth(startM)} ${shortYear(startY)} to ${shortMonth(endM)} ${shortYear(endY)}`;
  }

  // 2. Match span with year on end only: "April - August 2025", "April to August 25"
  const spanEndYear = range.match(/^([A-Za-z]+)\s*(?:to|-)\s*([A-Za-z]+)\s*(\d{2}|\d{4})$/i);
  if (spanEndYear) {
    const startM = spanEndYear[1];
    const endM = spanEndYear[2];
    const endY = toFullYear(spanEndYear[3], feeYear);
    const fullStartMonth = MONTHS.find(m => m.toLowerCase().startsWith(startM.toLowerCase().substring(0, 3)));
    const fullEndMonth = MONTHS.find(m => m.toLowerCase().startsWith(endM.toLowerCase().substring(0, 3)));
    const startIdx = MONTHS.indexOf(fullStartMonth);
    const endIdx = MONTHS.indexOf(fullEndMonth);
    const startY = (startIdx > endIdx) ? endY - 1 : endY;
    return `${shortMonth(startM)} ${shortYear(startY)} to ${shortMonth(endM)} ${shortYear(endY)}`;
  }

  // 3. Match span with year on start only: "April 2025 to August", "April 25 to August"
  const spanStartYear = range.match(/^([A-Za-z]+)\s*(\d{2}|\d{4})\s*(?:to|-)\s*([A-Za-z]+)$/i);
  if (spanStartYear) {
    const startM = spanStartYear[1];
    const endM = spanStartYear[3];
    const startY = toFullYear(spanStartYear[2], feeYear);
    const fullStartMonth = MONTHS.find(m => m.toLowerCase().startsWith(startM.toLowerCase().substring(0, 3)));
    const fullEndMonth = MONTHS.find(m => m.toLowerCase().startsWith(endM.toLowerCase().substring(0, 3)));
    const startIdx = MONTHS.indexOf(fullStartMonth);
    const endIdx = MONTHS.indexOf(fullEndMonth);
    const endY = feeYear || ((startIdx > endIdx) ? startY + 1 : startY);
    return `${shortMonth(startM)} ${shortYear(startY)} to ${shortMonth(endM)} ${shortYear(endY)}`;
  }

  // 4. Legacy span without years: "August - October" or "August to October"
  const legacySpan = range.match(/^([A-Za-z]+)\s*(?:to|-)\s*([A-Za-z]+)$/i);
  if (legacySpan) {
    const fullStartMonth = MONTHS.find(m => m.toLowerCase().startsWith(legacySpan[1].toLowerCase().substring(0, 3)));
    const fullEndMonth = MONTHS.find(m => m.toLowerCase().startsWith(legacySpan[2].toLowerCase().substring(0, 3)));
    const startIdx = MONTHS.indexOf(fullStartMonth);
    const endIdx = MONTHS.indexOf(fullEndMonth);
    const startYear = (startIdx > endIdx) ? feeYear - 1 : feeYear;
    return `${shortMonth(legacySpan[1])} ${shortYear(startYear)} to ${shortMonth(legacySpan[2])} ${shortYear(feeYear)}`;
  }

  // 5. Single month with year: "Aug 26", "August 26", "August 2026", "April 25", "April 2025"
  const singleWithYear = range.match(/^([A-Za-z]+)\s*(\d{2}|\d{4})$/);
  if (singleWithYear) {
    const month = singleWithYear[1];
    const year = toFullYear(singleWithYear[2], feeYear);
    return `${shortMonth(month)} ${shortYear(year)}`;
  }

  // 6. Single month fallback (e.g. "August")
  const singleMonth = MONTHS.find(m => m.toLowerCase().startsWith(range.toLowerCase().substring(0, 3)));
  if (singleMonth) {
    return `${shortMonth(singleMonth)} ${shortYear(feeYear)}`;
  }

  return range;
};
