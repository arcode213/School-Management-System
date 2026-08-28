// Single source of truth for the school's class list.
//
// Student academic records and class fee structures are matched by this exact
// `className` value during challan generation, so the list MUST be identical
// everywhere it is used (student form + fee structure page). Import from here
// rather than redefining it locally.
export const CLASSES = ['Nursery', 'KG1', 'KG2', '1', '2', '3', '4', '5', '6', '7', '8'];

export const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

/**
 * Formats class name into a standard representation (e.g. Nursery, KG - I, KG - II, 1, 2, 3...)
 */
export const formatClassName = (cls) => {
  if (cls === null || cls === undefined) return '';
  const s = String(cls).trim();
  if (/^kg\s*[-_]?\s*1$/i.test(s) || /^kg\s*[-_]?\s*i$/i.test(s)) return 'KG - I';
  if (/^kg\s*[-_]?\s*2$/i.test(s) || /^kg\s*[-_]?\s*ii$/i.test(s)) return 'KG - II';
  return s;
};
