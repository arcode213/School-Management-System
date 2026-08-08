const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { formatMonthKey } = require('./ledgerMonth');

/**
 * Workbook and PDF builders for the accounts reports.
 *
 * Both take the same shape — a title block plus columns and rows — so a report is
 * defined once and can be asked for in either format. Neither library is streamed
 * to a file: on serverless there is no writable disk, so everything is assembled
 * in memory and piped straight to the response.
 *
 * Money is written to Excel as a NUMBER with a display format, never as the
 * pre-formatted "Rs. 1,200" string. A spreadsheet whose amounts are text cannot
 * be summed, which is the first thing anyone does with an exported ledger.
 */

const PKR_FMT = '#,##0.00;[Red]-#,##0.00';

// ─── Excel ───────────────────────────────────────────────────────────────────

/**
 * @param {object} spec
 *   title, subtitle, meta[]      — the header block
 *   columns[{header,key,width,money,align}]
 *   rows[]                       — plain objects keyed by column key
 *   totals{}                     — optional footer row
 *   sheets[]                     — optional extra { name, ...spec } sheets
 */
const buildWorkbook = async (spec) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'School Management System';
  wb.created = new Date();

  const addSheet = (s) => {
    const ws = wb.addWorksheet(s.name || 'Report', {
      views: [{ state: 'frozen', ySplit: s.meta?.length ? 5 : 4 }],
    });

    const lastCol = s.columns.length;
    const merge = (row) => ws.mergeCells(row, 1, row, lastCol);

    ws.addRow([s.title]);
    merge(1);
    ws.getCell('A1').font = { size: 14, bold: true };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.addRow([s.subtitle || '']);
    merge(2);
    ws.getCell('A2').font = { size: 11, color: { argb: 'FF555555' } };
    ws.getCell('A2').alignment = { horizontal: 'center' };

    if (s.meta?.length) {
      ws.addRow([s.meta.join('    |    ')]);
      merge(3);
      ws.getCell('A3').font = { size: 9, color: { argb: 'FF777777' } };
      ws.getCell('A3').alignment = { horizontal: 'center' };
    }
    ws.addRow([]);

    const headerRow = ws.addRow(s.columns.map((c) => c.header));
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
    });

    s.columns.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 18; });

    for (const r of s.rows) {
      const row = ws.addRow(s.columns.map((c) => {
        const v = r[c.key];
        return c.money ? Number(v) || 0 : (v ?? '');
      }));
      s.columns.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        if (c.money) { cell.numFmt = PKR_FMT; cell.alignment = { horizontal: 'right' }; }
        else if (c.align) cell.alignment = { horizontal: c.align };
      });
    }

    if (s.totals) {
      const row = ws.addRow(s.columns.map((c, i) => {
        if (i === 0) return 'TOTAL';
        const v = s.totals[c.key];
        return v === undefined ? '' : (c.money ? Number(v) || 0 : v);
      }));
      row.font = { bold: true };
      row.eachCell((cell, i) => {
        cell.border = { top: { style: 'double', color: { argb: 'FF444444' } } };
        if (s.columns[i - 1]?.money) { cell.numFmt = PKR_FMT; cell.alignment = { horizontal: 'right' }; }
      });
    }

    // Excel's own filter row, so the recipient can slice the export further.
    if (s.rows.length > 0) {
      ws.autoFilter = {
        from: { row: headerRow.number, column: 1 },
        to: { row: headerRow.number + s.rows.length, column: lastCol },
      };
    }
  };

  (spec.sheets || [spec]).forEach(addSheet);
  return wb.xlsx.writeBuffer();
};

// ─── PDF ─────────────────────────────────────────────────────────────────────

/**
 * Resolves to a Buffer rather than piping straight to the response, so a failure
 * mid-render produces a clean 500 instead of a truncated download that looks like
 * a corrupt file to whoever opened it.
 */
const buildPdf = (spec) =>
  new Promise((resolve, reject) => {
    const landscape = spec.columns.length > 6;
    const doc = new PDFDocument({
      size: 'A4',
      layout: landscape ? 'landscape' : 'portrait',
      margin: 36,
      bufferPages: true,
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    // ── Title block ──
    doc.fontSize(16).fillColor('#111827').text(spec.title, { align: 'center' });
    if (spec.subtitle) {
      doc.moveDown(0.2).fontSize(11).fillColor('#4b5563').text(spec.subtitle, { align: 'center' });
    }
    if (spec.meta?.length) {
      doc.moveDown(0.2).fontSize(8).fillColor('#6b7280')
        .text(spec.meta.join('    |    '), { align: 'center' });
    }
    doc.moveDown(0.6);
    doc.moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).lineWidth(1.5).strokeColor('#4f46e5').stroke();
    doc.moveDown(0.5);

    // Columns are laid out by weight so the table always fills the page width
    // whatever the paper orientation turned out to be.
    const totalWeight = spec.columns.reduce((s, c) => s + (c.weight || 1), 0);
    const widths = spec.columns.map((c) => ((c.weight || 1) / totalWeight) * pageWidth);
    const xs = widths.reduce((acc, w, i) => [...acc, (acc[i] ?? left) + (i === 0 ? 0 : widths[i - 1])], [left]);

    const ROW_H = 16;
    const drawHeader = () => {
      const y = doc.y;
      doc.rect(left, y - 2, pageWidth, ROW_H).fill('#eef2ff');
      doc.fontSize(8).fillColor('#3730a3').font('Helvetica-Bold');
      spec.columns.forEach((c, i) => {
        doc.text(String(c.header).toUpperCase(), xs[i] + 3, y + 2, {
          width: widths[i] - 6,
          align: c.money ? 'right' : (c.align || 'left'),
          lineBreak: false,
        });
      });
      doc.y = y + ROW_H;
      doc.font('Helvetica');
    };

    drawHeader();

    const bottom = doc.page.height - doc.page.margins.bottom - 28;
    spec.rows.forEach((r, idx) => {
      if (doc.y + ROW_H > bottom) {
        doc.addPage({ layout: landscape ? 'landscape' : 'portrait', margin: 36 });
        drawHeader();
      }
      const y = doc.y;
      if (idx % 2 === 1) doc.rect(left, y - 2, pageWidth, ROW_H).fill('#f8fafc');

      doc.fontSize(8).fillColor('#1f2937');
      spec.columns.forEach((c, i) => {
        const raw = r[c.key];
        const text = c.money ? spec.fmtMoney(raw) : String(raw ?? '');
        doc.fillColor(c.money && Number(raw) < 0 ? '#b91c1c' : '#1f2937')
          .text(text, xs[i] + 3, y + 2, {
            width: widths[i] - 6,
            align: c.money ? 'right' : (c.align || 'left'),
            lineBreak: false,
            ellipsis: true,
          });
      });
      doc.y = y + ROW_H;
    });

    if (spec.totals) {
      if (doc.y + ROW_H > bottom) doc.addPage({ layout: landscape ? 'landscape' : 'portrait', margin: 36 });
      const y = doc.y + 2;
      doc.moveTo(left, y).lineTo(left + pageWidth, y).lineWidth(1).strokeColor('#374151').stroke();
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827');
      spec.columns.forEach((c, i) => {
        const v = i === 0 ? 'TOTAL' : spec.totals[c.key];
        if (v === undefined) return;
        doc.text(i === 0 ? 'TOTAL' : spec.fmtMoney(v), xs[i] + 3, y + 4, {
          width: widths[i] - 6,
          align: c.money ? 'right' : 'left',
          lineBreak: false,
        });
      });
      doc.font('Helvetica');
    }

    if (spec.footNote) {
      doc.moveDown(1.5).fontSize(7.5).fillColor('#6b7280')
        .text(spec.footNote, left, doc.y, { width: pageWidth, align: 'left' });
    }

    // Page numbering, added at the end so the total is known.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fontSize(7).fillColor('#9ca3af').text(
        `Generated ${new Date().toLocaleString('en-GB')}    ·    Page ${i + 1} of ${range.count}`,
        doc.page.margins.left,
        doc.page.height - doc.page.margins.bottom - 12,
        { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center' }
      );
    }

    doc.end();
  });

// ─── Response helpers ────────────────────────────────────────────────────────

const safeName = (s) => String(s).replace(/[^a-z0-9._-]+/gi, '_');

const sendWorkbook = async (res, spec, filename) => {
  const buffer = await buildWorkbook(spec);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}.xlsx"`);
  // The browser cannot read a custom header on a cross-origin download unless it
  // is exposed; the client reads the filename from it.
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(Buffer.from(buffer));
};

const sendPdf = async (res, spec, filename) => {
  const buffer = await buildPdf(spec);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}.pdf"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(buffer);
};

module.exports = { buildWorkbook, buildPdf, sendWorkbook, sendPdf, formatMonthKey };
