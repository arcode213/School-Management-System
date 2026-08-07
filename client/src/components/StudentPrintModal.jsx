import { useState } from 'react';
import { getStudents } from '../api/students';
import toast from 'react-hot-toast';
import { X, Printer, Loader2 } from 'lucide-react';

// All printable columns. `all checked by default`.
const COLUMNS = [
  { key: 'studentId',    label: 'Student ID',     get: s => s.studentId },
  { key: 'fullName',     label: 'Name',           get: s => s.fullName },
  { key: 'fatherName',   label: 'Father Name',    get: s => s.fatherName },
  { key: 'motherName',   label: 'Mother Name',    get: s => s.motherName },
  { key: 'class',        label: 'Class',          get: s => s.class },
  { key: 'section',      label: 'Section',        get: s => s.section },
  { key: 'rollNumber',   label: 'Roll No',        get: s => s.rollNumber },
  { key: 'gender',       label: 'Gender',         get: s => s.gender },
  { key: 'status',       label: 'Status',         get: s => s.status },
  { key: 'isFreeship',   label: 'Freeship',       get: s => (s.isFreeship ? 'Yes' : 'No') },
  { key: 'phone',        label: 'Phone',          get: s => s.phone },
  { key: 'fatherContact',label: 'Father Contact', get: s => s.fatherContact },
  { key: 'dateOfBirth',  label: 'Date of Birth',  get: s => s.dateOfBirth?.substring(0, 10) },
  { key: 'admissionDate',label: 'Admission Date', get: s => s.admissionDate?.substring(0, 10) },
  { key: 'address',      label: 'Address',        get: s => s.address },
];

const esc = (v) => String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function StudentPrintModal({ open, onClose, filters }) {
  // Start with every column selected.
  const [selected, setSelected] = useState(() => COLUMNS.reduce((acc, c) => ({ ...acc, [c.key]: true }), {}));
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const toggle = (key) => setSelected(s => ({ ...s, [key]: !s[key] }));
  const allChecked = COLUMNS.every(c => selected[c.key]);
  const toggleAll = () => {
    const next = !allChecked;
    setSelected(COLUMNS.reduce((acc, c) => ({ ...acc, [c.key]: next }), {}));
  };

  const activeCols = COLUMNS.filter(c => selected[c.key]);

  const filterSummary = () => {
    const parts = [];
    if (filters.gender) parts.push(filters.gender === 'Male' ? 'Boys' : filters.gender === 'Female' ? 'Girls' : filters.gender);
    if (filters.class) parts.push(`Class ${filters.class}`);
    if (filters.section) parts.push(`Section ${filters.section}`);
    if (filters.status) parts.push(filters.status);
    if (filters.freeship === 'yes') parts.push('Freeship only');
    else if (filters.freeship === 'no') parts.push('Paying only');
    if (filters.search) parts.push(`Search: "${filters.search}"`);
    return parts.length ? parts.join(' • ') : 'All Students';
  };

  const handlePrint = async () => {
    if (activeCols.length === 0) { toast.error('Select at least one column'); return; }
    setLoading(true);
    try {
      // Fetch every record matching the current filters (not just the visible page).
      const { data } = await getStudents({ ...filters, page: 1, limit: 100000 });
      const students = data.students || [];
      if (students.length === 0) { toast.error('No students match the current filters'); setLoading(false); return; }

      const headRow = activeCols.map(c => `<th>${esc(c.label)}</th>`).join('');
      const bodyRows = students.map((s, i) => {
        const cells = activeCols.map(c => `<td>${esc(c.get(s))}</td>`).join('');
        return `<tr><td>${i + 1}</td>${cells}</tr>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><title>Student Records</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #1e293b; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; }
          th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
          tr:nth-child(even) td { background: #f8fafc; }
          @media print { body { margin: 10mm; } @page { size: landscape; } }
        </style></head><body>
        <h1>Student Records</h1>
        <div class="meta">Filter: ${esc(filterSummary())} &nbsp;|&nbsp; Total: ${students.length} &nbsp;|&nbsp; Printed: ${new Date().toLocaleString()}</div>
        <table><thead><tr><th>#</th>${headRow}</tr></thead><tbody>${bodyRows}</tbody></table>
        <script>window.onload = function(){ window.print(); }</script>
        </body></html>`;

      const win = window.open('', '_blank');
      if (!win) { toast.error('Allow pop-ups to print'); setLoading(false); return; }
      win.document.write(html);
      win.document.close();
      onClose();
    } catch {
      toast.error('Failed to load students for printing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-solid rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center">
              <Printer className="t-body w-4 h-4" />
            </div>
            <h2 className="font-semibold t-body">Print Student Records</h2>
          </div>
          <button onClick={onClose} className="t-muted hover:t-muted"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="bg-brand-soft border border-brand-border t-brand text-sm rounded-lg p-3">
            Printing <strong>{filterSummary()}</strong>. Adjust the filters on the Students page to change who is included.
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold t-body">Columns to print</h3>
            <button onClick={toggleAll} className="text-xs t-brand hover:underline">
              {allChecked ? 'Uncheck all' : 'Check all'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {COLUMNS.map(c => (
              <label key={c.key} className="flex items-center gap-2 text-sm t-body cursor-pointer p-1.5 rounded hover:bg-surface-2">
                <input type="checkbox" checked={!!selected[c.key]} onChange={() => toggle(c.key)} className="rounded" />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-line flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm t-muted border border-line rounded-lg">Cancel</button>
          <button onClick={handlePrint} disabled={loading} className="px-5 py-2 text-sm bg-brand hover:bg-brand t-body font-medium rounded-lg flex items-center gap-2 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
