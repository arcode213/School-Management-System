// Small shared helper for client-side CSV export.
//
// - Quotes every field and doubles embedded quotes so commas, newlines and
//   quotation marks inside a value can never break the column layout.
// - Prepends a UTF-8 BOM so Excel opens names with non-ASCII characters
//   (e.g. Urdu/accented letters) correctly instead of as mojibake.

const escapeCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

// headers: string[]   rows: (string|number|null|undefined)[][]
export const downloadCsv = (filename, headers, rows) => {
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(','));
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Convenience: build rows from an array of objects and a column spec
// (each column is { label, get }) and trigger the download.
export const exportObjectsToCsv = (filename, columns, items) => {
  const headers = columns.map((c) => c.label);
  const rows = items.map((item) => columns.map((c) => c.get(item)));
  downloadCsv(filename, headers, rows);
};
