// Calibration + field-position map for printing fee values onto the school's
// pre-printed challan paper (challan.jpeg). Positions are expressed as a
// percentage of the full sheet so they stay correct at any paper size; the
// per-user calibration (offset / scale / paper size) compensates for printer
// margins and the exact physical sheet dimensions.

const STORAGE_KEY = 'challanCalibration';

// Horizontal distance between the left (Student) and right (School) copy.
export const COPY_OFFSET_X = 49.9;

// Sensible defaults. The user fine-tunes these from the Print Preview screen and
// the values are persisted to localStorage.
export const DEFAULT_CALIBRATION = {
  paperWidth: 210,   // mm — measure your physical challan sheet and set this
  paperHeight: 297,  // mm
  offsetX: 0,        // mm — nudge everything right (+) / left (-)
  offsetY: 0,        // mm — nudge everything down (+) / up (-)
  scale: 100,        // % — shrink/grow the whole overlay
  fontScale: 100,    // % — text size relative to the auto-computed base
  printBackground: false, // print the form image too (for plain paper)

  fieldMap: {
    challanNo:   { x: 14.2, y: 42.0, align: 'left' },
    issueDate:   { x: 35.0, y: 42.0, align: 'left' },
    studentName: { x: 18.0, y: 45.7, align: 'left' },
    fatherName:  { x: 16.8, y: 49.3, align: 'left' },
    className:   { x: 10.0, y: 52.9, align: 'left' },
    section:     { x: 35.0, y: 52.9, align: 'left' },
    dueDate:     { x: 13.0, y: 56.6, align: 'left' },
    month:       { x: 35.0, y: 56.6, align: 'left' },
  },

  tableMap: {
    titleX: 6,        // left edge of the "Fee Title" column
    amountRightX: 46, // right edge of the "Amount" column (amounts right-aligned)
    firstRowY: 64.5,  // vertical centre of the first line-item row
    rowStep: 3.3,     // vertical gap between rows
    maxRows: 6,
    netByDueY: 87.0,      // "Net Payable by Due Date" amount row
    netAfterDueY: 90.5,   // "Net Payable by after Due Date" amount row
  }
};

export const loadCalibration = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Merge deeply so new fields added later don't crash old saves
    return { 
      ...DEFAULT_CALIBRATION, 
      ...(saved || {}),
      fieldMap: { ...DEFAULT_CALIBRATION.fieldMap, ...(saved?.fieldMap || {}) },
      tableMap: { ...DEFAULT_CALIBRATION.tableMap, ...(saved?.tableMap || {}) }
    };
  } catch {
    return { ...DEFAULT_CALIBRATION };
  }
};

export const saveCalibration = (calib) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(calib));
};
