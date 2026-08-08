import { useState } from 'react';
import { X, UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as xlsx from 'xlsx';
import api from '../api/axios';
import ModalPortal from './ModalPortal';

// Rows are sent in batches instead of one giant JSON body. A single request with
// a full sheet exceeded the server's body limit (413 "request entity too large"),
// and on serverless hosting the platform caps the body regardless of that limit.
const CHUNK_SIZE = 100;

const pad = (n) => String(n).padStart(2, '0');

// Date cells must never travel as JS Dates. `cellDates: true` builds them from a
// LOCAL 1899-12-30 epoch, and in any zone whose historic LMT offset carried a
// seconds component (Asia/Karachi was +04:28:12) every date lands a few seconds
// SHORT of local midnight: a cell showing "May-26" arrives as
// 2026-04-30T23:59:48 local. Reading its calendar parts then moved the row back a
// day — and since arrears periods are always the 1st of a month, back a whole
// MONTH. An arrears period entered as April - May imported as March - April.
//
// So date cells are converted from their Excel serial with SSF.parse_date_code,
// which is pure integer arithmetic with no clock or timezone involved at all, and
// sent as a plain "YYYY-MM-DD" string — exactly what the user sees in the cell.
const serialToCalendarString = (serial) => {
  const d = xlsx.SSF.parse_date_code(serial);
  return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : null;
};

// Fallback for a Date that reaches us from somewhere else (a CSV, a pre-parsed
// cell). Snap to the nearest local midnight first so the same seconds-level drift
// cannot round the day down.
const toCalendarString = (d) => {
  const msIntoDay =
    d.getHours() * 3600000 + d.getMinutes() * 60000 + d.getSeconds() * 1000 + d.getMilliseconds();
  const snapped = new Date(d.getTime() + (msIntoDay >= 43200000 ? 86400000 - msIntoDay : -msIntoDay));
  return `${snapped.getFullYear()}-${pad(snapped.getMonth() + 1)}-${pad(snapped.getDate())}`;
};

// Rewrite every date-formatted numeric cell into a "YYYY-MM-DD" text cell before
// sheet_to_json runs. Done on the sheet rather than on the parsed rows because
// only the cell still knows its number format — by the time it is a row value, a
// date serial is indistinguishable from an ordinary number (46143 vs a fee of
// 46143), which is why the serials cannot simply be passed through raw.
const stringifyDateCells = (sheet) => {
  if (!sheet || !sheet['!ref']) return;
  const range = xlsx.utils.decode_range(sheet['!ref']);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[xlsx.utils.encode_cell({ r, c })];
      // v >= 1 skips time-only values, whose format is also reported as a date but
      // which carry no calendar day to speak of.
      if (!cell || cell.t !== 'n' || !cell.z || !xlsx.SSF.is_date(cell.z) || cell.v < 1) continue;
      const text = serialToCalendarString(cell.v);
      if (!text) continue;
      cell.t = 's';
      cell.v = text;
      cell.w = text;
      delete cell.z;
    }
  }
};

const normalizeCellDates = (row) => {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date && !isNaN(value.getTime()) ? toCalendarString(value) : value;
  }
  return out;
};

export default function ImportExcelModal({ open, onClose, onImportSuccess, type }) {
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(null);

  if (!open) return null;

  const downloadTemplate = () => {
    let headers = [];
    let fileName = '';
    
    if (type === 'students') {
      headers = [
        'fullName', 'fatherName', 'fatherOccupation', 'dateOfBirth', 'placeOfBirth', 'gender',
        'cast', 'religion', 'nationality', 'motherTongue', 'cnic', 'fatherCnic',
        'phone', 'fatherContact', 'motherContact', 'emergencyContact',
        'class', 'section', 'lastSchool', 'rollNumber', 'admissionDate', 'status',
        'isFreeship', 'previousDues', 'previousDuesFrom', 'previousDuesTo',
        'previousAnnualFee', 'annualFeePaid', 'address'
      ];
      fileName = 'students_template.xlsx';
    } else if (type === 'employees') {
      headers = [
        'fullName', 'fatherName', 'dateOfBirth', 'gender', 'cnic', 'phone', 'email', 
        'designation', 'department', 'subject', 'joiningDate', 'status', 
        'salary', 'allowances', 'deductions', 'qualification', 'experience', 'address'
      ];
      fileName = 'employees_template.xlsx';
    }

    const ws = xlsx.utils.aoa_to_sheet([headers]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Template");
    xlsx.writeFile(wb, fileName);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    
    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error('Please upload a valid Excel or CSV file.');
      return;
    }

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      // cellNF keeps each cell's number format, which is the only way to tell a
      // date serial from an ordinary number. cellDates is deliberately OFF — see
      // stringifyDateCells for why its Dates cannot be trusted.
      const workbook = xlsx.read(data, { type: 'array', cellNF: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      stringifyDateCells(sheet);
      const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

      // Excel files routinely carry trailing rows that look empty but still have
      // cells attached. Sending those makes the server reject the batch over a
      // row the user never filled in.
      const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
      const parsedData = rows
        .filter((row) => Object.values(row).some((v) => !isBlank(v)))
        .map(normalizeCellDates);

      if (parsedData.length === 0) {
        toast.error('The file is empty.');
        setLoading(false);
        return;
      }

      // NOTE: the axios instance already has baseURL '.../api', so paths here must
      // NOT be prefixed with '/api' (doing so produced '/api/api/...' -> 404).
      const endpoint = type === 'students' ? '/students/bulk' : '/employees/bulk';
      const payloadKey = type === 'students' ? 'students' : 'employees';
      const label = type === 'students' ? 'students' : 'employees';

      const total = parsedData.length;
      let imported = 0;
      setProgress({ done: 0, total });

      // Each batch is committed in its own transaction server-side, so a failure
      // part-way through keeps everything already imported.
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = parsedData.slice(i, i + CHUNK_SIZE);
        try {
          // rowOffset lets the server report failures using the row number as it
          // appears in the user's file, not the row's index inside this batch.
          await api.post(endpoint, { [payloadKey]: chunk, rowOffset: i });
        } catch (err) {
          console.error(err);
          const reason = err.response?.data?.message || 'Failed to import data';
          if (imported > 0) {
            toast.error(`Imported ${imported} of ${total} rows, then stopped. ${reason}`);
            onImportSuccess();
          } else {
            toast.error(reason);
          }
          return;
        }
        imported += chunk.length;
        setProgress({ done: imported, total });
      }

      toast.success(`${imported} ${label} imported successfully`);
      onImportSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to import data');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <ModalPortal>
    <div className="modal-shell bg-black/55 backdrop-blur-sm">
      <div className="modal-box bg-solid shadow-xl sm:max-w-lg animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-line flex-shrink-0">
          <h2 className="text-lg font-bold t-body truncate">
            Import {type === 'students' ? 'Students' : 'Employees'}
          </h2>
          <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-brand-soft border border-brand-border rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3 min-w-0">
              <FileSpreadsheet className="t-brand flex-shrink-0" size={24} />
              <div className="min-w-0">
                <p className="text-sm font-semibold t-body">Download Template</p>
                <p className="text-xs t-faint">Fill your data according to the format.</p>
              </div>
            </div>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 bg-solid t-brand text-sm font-medium border border-brand-border rounded-lg shadow-sm hover:bg-brand-soft transition flex-shrink-0">
              Download
            </button>
          </div>

          <div
            className={`relative flex flex-col items-center justify-center p-6 sm:p-10 border-2 border-dashed rounded-2xl transition ${dragActive ? 'border-brand bg-brand-soft' : 'border-line bg-surface-2 hover:bg-surface-2'}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={loading}
            />
            <div className="flex flex-col items-center pointer-events-none">
              <UploadCloud size={40} className={`mb-3 ${dragActive ? 't-brand' : 't-muted'}`} />
              <p className="text-sm font-medium t-body">Drag & Drop file here</p>
              <p className="text-xs t-faint mt-1">or click to browse (.xlsx, .csv)</p>
            </div>
          </div>
          
          {type === 'students' && (
            <div className="mt-4 bg-surface-2 border border-line rounded-lg p-3 text-xs t-muted space-y-1.5">
              <p className="font-semibold t-body">Fee columns</p>
              <p>
                <code className="bg-solid border px-1 rounded">isFreeship</code> — enter <strong>Yes</strong> for
                students whose fees the school has waived. No challan is generated or printed for them. Leave blank for
                paying students.
              </p>
              <p>
                <code className="bg-solid border px-1 rounded">previousDues</code> — outstanding <strong>monthly</strong>{' '}
                fee the student already owes, with{' '}
                <code className="bg-solid border px-1 rounded">previousDuesFrom</code> /{' '}
                <code className="bg-solid border px-1 rounded">previousDuesTo</code> giving the months it covers. No
                challan is created for it — it is recorded as an opening balance, shows in <em>Outstanding Dues</em>,
                and is carried into the next challan you generate as <em>Previous Arrears</em>.
              </p>
              <p>
                <code className="bg-solid border px-1 rounded">previousAnnualFee</code> — unpaid{' '}
                <strong>annual</strong> fee from before. Tracked separately and printed on its own{' '}
                <em>Previous Annual Fee</em> line, so it is never mixed into the monthly arrears. No date range needed.
              </p>
              <p>
                <code className="bg-solid border px-1 rounded">annualFeePaid</code> — for students who have{' '}
                <strong>already paid this session's annual fee</strong>. Enter the amount they paid and it is
                recorded as settled, so <em>Generate Fees</em> will not charge them the annual fee again this
                session. Enter <strong>0</strong> or leave it blank for students who have not paid — their annual
                fee stays at zero until you charge it from <em>Generate Fees</em>.
              </p>
              <p className="t-faint">
                Dates accept a real date cell, <code className="bg-solid border px-1 rounded">2026-01-15</code>,{' '}
                <code className="bg-solid border px-1 rounded">January 2026</code> or{' '}
                <code className="bg-solid border px-1 rounded">2026-01</code>.
              </p>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 t-warn bg-warn-soft p-3 rounded-lg text-xs">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>Make sure the header names exactly match the template. Invalid data may cause the entire import to fail.</p>
          </div>
        </div>

        <div className="p-4 border-t border-line modal-actions bg-surface-2 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-4 py-2.5 text-sm font-medium t-muted bg-solid border border-line rounded-xl hover:bg-surface-2 transition">
            Cancel
          </button>
        </div>
        
        {loading && (
          <div className="absolute inset-0 bg-solid backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-medium t-body">
              {progress ? `Importing ${progress.done} of ${progress.total} rows...` : 'Processing File...'}
            </p>
            {progress && progress.total > 0 && (
              <div className="mt-3 w-48 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand transition-all duration-300"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
