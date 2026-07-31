import { useState } from 'react';
import { X, UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as xlsx from 'xlsx';
import api from '../api/axios';

// Rows are sent in batches instead of one giant JSON body. A single request with
// a full sheet exceeded the server's body limit (413 "request entity too large"),
// and on serverless hosting the platform caps the body regardless of that limit.
const CHUNK_SIZE = 100;

const pad = (n) => String(n).padStart(2, '0');

// A date cell read with `cellDates: true` comes back as a Date pinned to LOCAL
// midnight — 01-Apr-2025 in a UTC+5 browser is 2025-03-31T19:00:00Z. Sending that
// straight to the server (which reads dates in UTC, deliberately, so a date-only
// value can't drift) landed the row on the WRONG MONTH: an arrears period entered
// as April - June was stored as March - May.
//
// Serialising the Date's LOCAL calendar parts instead sends exactly what the user
// sees in the cell, with no clock or timezone attached for anything to shift.
const toCalendarString = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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
        'previousAnnualFee', 'address'
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
      // cellDates: true makes date-formatted cells arrive as real Dates instead of
      // Excel serial numbers (a raw 45678 would otherwise be cast to 1970).
      const workbook = xlsx.read(data, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            Import {type === 'students' ? 'Students' : 'Employees'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="text-blue-500" size={24} />
              <div>
                <p className="text-sm font-semibold text-slate-700">Download Template</p>
                <p className="text-xs text-slate-500">Fill your data according to the format.</p>
              </div>
            </div>
            <button 
              onClick={downloadTemplate}
              className="px-4 py-2 bg-white text-blue-600 text-sm font-medium border border-blue-200 rounded-lg shadow-sm hover:bg-blue-50 transition">
              Download
            </button>
          </div>

          <div
            className={`relative flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-2xl transition ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
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
              <UploadCloud size={40} className={`mb-3 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`} />
              <p className="text-sm font-medium text-slate-700">Drag & Drop file here</p>
              <p className="text-xs text-slate-500 mt-1">or click to browse (.xlsx, .csv)</p>
            </div>
          </div>
          
          {type === 'students' && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-700">Fee columns</p>
              <p>
                <code className="bg-white border px-1 rounded">isFreeship</code> — enter <strong>Yes</strong> for
                students whose fees the school has waived. No challan is generated or printed for them. Leave blank for
                paying students.
              </p>
              <p>
                <code className="bg-white border px-1 rounded">previousDues</code> — outstanding <strong>monthly</strong>{' '}
                fee the student already owes, with{' '}
                <code className="bg-white border px-1 rounded">previousDuesFrom</code> /{' '}
                <code className="bg-white border px-1 rounded">previousDuesTo</code> giving the months it covers. No
                challan is created for it — it is recorded as an opening balance, shows in <em>Outstanding Dues</em>,
                and is carried into the next challan you generate as <em>Previous Arrears</em>.
              </p>
              <p>
                <code className="bg-white border px-1 rounded">previousAnnualFee</code> — unpaid{' '}
                <strong>annual</strong> fee from before. Tracked separately and printed on its own{' '}
                <em>Previous Annual Fee</em> line, so it is never mixed into the monthly arrears. No date range needed.
              </p>
              <p className="text-slate-500">
                Dates accept a real date cell, <code className="bg-white border px-1 rounded">2026-01-15</code>,{' '}
                <code className="bg-white border px-1 rounded">January 2026</code> or{' '}
                <code className="bg-white border px-1 rounded">2026-01</code>.
              </p>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg text-xs">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>Make sure the header names exactly match the template. Invalid data may cause the entire import to fail.</p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
            Cancel
          </button>
        </div>
        
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-medium text-slate-700">
              {progress ? `Importing ${progress.done} of ${progress.total} rows...` : 'Processing File...'}
            </p>
            {progress && progress.total > 0 && (
              <div className="mt-3 w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
