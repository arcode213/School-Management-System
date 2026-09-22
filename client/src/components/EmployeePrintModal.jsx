import { useState } from 'react';
import { getEmployees } from '../api/employees';
import toast from 'react-hot-toast';
import { X, Printer, Loader2 } from 'lucide-react';
import ModalPortal from './ModalPortal';

// All printable employee columns. Checked by default.
const COLUMNS = [
  { key: 'employeeId',    label: 'Employee ID',    get: e => e.employeeId },
  { key: 'fullName',      label: 'Full Name',      get: e => e.fullName },
  { key: 'fatherName',    label: 'Father Name',    get: e => e.fatherName },
  { key: 'designation',   label: 'Designation',    get: e => e.designation },
  { key: 'department',    label: 'Department',     get: e => e.department },
  { key: 'subject',       label: 'Subject',        get: e => e.subject },
  { key: 'status',        label: 'Status',         get: e => e.status },
  { key: 'phone',         label: 'Phone',          get: e => e.phone },
  { key: 'email',         label: 'Email',          get: e => e.email },
  { key: 'cnic',          label: 'CNIC',           get: e => e.cnic },
  { key: 'salary',        label: 'Salary',         get: e => e.salary },
  { key: 'joiningDate',   label: 'Joining Date',   get: e => e.joiningDate?.substring(0, 10) },
  { key: 'qualification', label: 'Qualification',  get: e => e.qualification },
  { key: 'gender',        label: 'Gender',         get: e => e.gender },
  { key: 'address',       label: 'Address',        get: e => e.address },
];

const esc = (v) => String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function EmployeePrintModal({ open, onClose, filters }) {
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
    if (filters.designation) parts.push(`Designation: ${filters.designation}`);
    if (filters.department) parts.push(`Department: ${filters.department}`);
    if (filters.status) parts.push(`Status: ${filters.status}`);
    if (filters.search) parts.push(`Search: "${filters.search}"`);
    return parts.length ? parts.join(' • ') : 'All Staff / Teachers';
  };

  const handlePrint = async () => {
    if (activeCols.length === 0) { toast.error('Select at least one column'); return; }
    setLoading(true);
    try {
      // Fetch every record matching current filters
      const { data } = await getEmployees({ ...filters, page: 1, limit: 100000 });
      const employees = data.employees || [];
      if (employees.length === 0) { toast.error('No employees match the current filters'); setLoading(false); return; }

      const headRow = activeCols.map(c => `<th>${esc(c.label)}</th>`).join('');
      const bodyRows = employees.map((e, i) => {
        const cells = activeCols.map(c => `<td>${esc(c.get(e))}</td>`).join('');
        return `<tr><td>${i + 1}</td>${cells}</tr>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><title>Staff & Teacher Records</title>
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
        <h1>Staff & Teacher Directory</h1>
        <div class="meta">Filter: ${esc(filterSummary())} &nbsp;|&nbsp; Total: ${employees.length} &nbsp;|&nbsp; Printed: ${new Date().toLocaleString()}</div>
        <table><thead><tr><th>#</th>${headRow}</tr></thead><tbody>${bodyRows}</tbody></table>
        <script>window.onload = function(){ window.print(); }</script>
        </body></html>`;

      const win = window.open('', '_blank');
      if (!win) { toast.error('Allow pop-ups to print'); setLoading(false); return; }
      win.document.write(html);
      win.document.close();
      onClose();
    } catch {
      toast.error('Failed to load employee records for printing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal>
      <div className="modal-shell">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="modal-box bg-solid shadow-2xl sm:max-w-lg">
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-brand rounded-xl flex items-center justify-center flex-shrink-0">
                <Printer className="t-body w-4 h-4" />
              </div>
              <h2 className="font-semibold t-body truncate">Print Staff / Teacher Records</h2>
            </div>
            <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="Close"><X size={20} /></button>
          </div>

          <div className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
            <div className="bg-brand-soft border border-brand-border t-brand text-sm rounded-lg p-3">
              Printing <strong>{filterSummary()}</strong>. Adjust the filters on the Staff page to change who is included.
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

          <div className="px-5 sm:px-6 py-4 border-t border-line modal-actions flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm t-muted border border-line rounded-lg">Cancel</button>
            <button onClick={handlePrint} disabled={loading} className="px-5 py-2.5 text-sm bg-brand hover:bg-brand t-body font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              Print
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
