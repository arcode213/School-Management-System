import { useState, useEffect, useMemo } from 'react';
import { getDues } from '../api/fees';
import { getClasses } from '../api/students';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { AlertCircle, Download, Search, Printer } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export default function DuesPage() {
  const { currentCampus, currentSession, campuses, sessions } = useAppContext();
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  // Filters
  const [filterClass, setFilterClass] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [search, setSearch] = useState('');

  // Reload whenever the active campus/session changes.
  useEffect(() => {
    if (!currentCampus || !currentSession) return;
    getClasses().then(r => setClasses(r.data)).catch(() => {});

    setLoading(true);
    getDues()
      .then(res => setDues(res.data))
      .catch(() => toast.error('Failed to load dues'))
      .finally(() => setLoading(false));
  }, [currentCampus, currentSession]);

  const filteredDues = useMemo(() => {
    return dues.filter(d => {
      const matchClass = filterClass ? d.student?.class === filterClass : true;
      const matchMonth = filterMonth ? d.feeMonth === filterMonth : true;
      const matchSearch = search ? (
        d.student?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        d.student?.studentId?.toLowerCase().includes(search.toLowerCase()) ||
        d.challanNo?.toLowerCase().includes(search.toLowerCase())
      ) : true;
      return matchClass && matchMonth && matchSearch;
    });
  }, [dues, filterClass, filterMonth, search]);

  const totalOutstanding = filteredDues.reduce((acc, curr) => acc + (curr.balance || 0), 0);

  const exportCSV = () => {
    const headers = ['Challan No', 'Student ID', 'Student Name', 'Father Name', 'Class', 'Month', 'Total Fee', 'Paid', 'Discount', 'Remaining Due'];
    const rows = filteredDues.map(d => {
      const remaining = d.balance || 0;
      return [
        d.challanNo, d.student?.studentId, d.student?.fullName, d.student?.fatherName, `${d.student?.class} ${d.student?.section || ''}`,
        `${d.dueMonthRange || d.feeMonth} ${d.feeYear}`, d.totalAmount, d.amountPaid || 0, d.discount || 0, remaining
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Outstanding_Dues.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    if (filteredDues.length === 0) return;

    const campusName = campuses.find(c => c._id === currentCampus)?.name || 'All Campuses';
    const sessionName = sessions.find(s => s._id === currentSession)?.name || '';
    const printedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const appliedFilters = [
      filterClass && `Class: ${filterClass}`,
      filterMonth && `Month: ${filterMonth}`,
      search && `Search: "${search}"`,
    ].filter(Boolean).join('  •  ');

    const rows = filteredDues.map((d, i) => {
      const remaining = d.balance || 0;
      const paidDisc = (d.amountPaid || 0) + (d.discount || 0);
      return `
        <tr>
          <td class="c">${i + 1}</td>
          <td class="mono">${escapeHtml(d.challanNo)}</td>
          <td>${escapeHtml(d.student?.studentId)}</td>
          <td>${escapeHtml(d.student?.fullName)}${d.student?.fatherName ? `<br/><span class="sub">s/o ${escapeHtml(d.student.fatherName)}</span>` : ''}</td>
          <td>${escapeHtml(`${d.student?.class || ''} ${d.student?.section || ''}`)}</td>
          <td>${escapeHtml(`${d.dueMonthRange || d.feeMonth} ${d.feeYear}`)}</td>
          <td class="r">${(d.totalAmount || 0).toLocaleString()}</td>
          <td class="r">${paidDisc.toLocaleString()}</td>
          <td class="r due">${remaining.toLocaleString()}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Outstanding Dues Report</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 24px; }
          .head { text-align: center; border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 6px; }
          .head h1 { margin: 0; font-size: 20px; }
          .head h2 { margin: 4px 0 0; font-size: 14px; font-weight: 600; }
          .meta { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin: 8px 0 14px; }
          .filters { font-size: 11px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
          thead th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
          td.r, th.r { text-align: right; }
          td.c, th.c { text-align: center; }
          td.mono { font-family: 'Courier New', monospace; }
          td.due { font-weight: bold; color: #b91c1c; }
          td.sub, .sub { color: #64748b; font-weight: normal; font-size: 10px; }
          tfoot td { font-weight: bold; background: #fef2f2; font-size: 12px; }
          .foot { margin-top: 18px; font-size: 10px; color: #94a3b8; text-align: center; }
          @media print { body { margin: 10mm; } }
        </style>
      </head>
      <body>
        <div class="head">
          <h1>${escapeHtml(campusName)}</h1>
          <h2>Outstanding Dues Report${sessionName ? ` — Session ${escapeHtml(sessionName)}` : ''}</h2>
        </div>
        <div class="meta">
          <span class="filters">${appliedFilters || 'All records'}</span>
          <span>Printed: ${printedOn}&nbsp;&nbsp;|&nbsp;&nbsp;${filteredDues.length} record(s)</span>
        </div>
        <table>
          <thead>
            <tr>
              <th class="c">#</th>
              <th>Challan No.</th>
              <th>Student ID</th>
              <th>Student</th>
              <th>Class</th>
              <th>Month</th>
              <th class="r">Total Fee</th>
              <th class="r">Paid/Disc</th>
              <th class="r">Remaining Due</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="8" class="r">Total Outstanding</td>
              <td class="r due">Rs. ${totalOutstanding.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
        <div class="foot">Generated by School Management System</div>
      </body>
      </html>`;

    const win = window.open('', '_blank');
    if (!win) return toast.error('Please allow pop-ups to print the report');
    win.document.write(html);
    win.document.close();
    win.focus();
    // Give the new window a tick to render before invoking the print dialog.
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Outstanding Dues</h1>
          <p className="text-slate-400 text-sm mt-0.5">{filteredDues.length} records found</p>
        </div>
        <div className="flex gap-2">
          <button onClick={printReport} disabled={filteredDues.length === 0}
            className="flex items-center gap-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2 transition shadow-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            <Printer size={14} /> Print Report
          </button>
          <button onClick={exportCSV} disabled={filteredDues.length === 0}
            className="flex items-center gap-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2 transition shadow-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-center justify-between shadow-sm col-span-1 md:col-span-3">
          <div>
            <p className="text-red-600 text-sm font-semibold mb-1">Total Outstanding Amount</p>
            <h2 className="text-3xl font-bold text-red-700">Rs. {totalOutstanding.toLocaleString()}</h2>
          </div>
          <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or receipt..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500" />
        </div>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-32">
          <option value="">All Months</option>
          {MONTHS.map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-32">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full mx-auto" /></div>
        ) : filteredDues.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No outstanding dues for this criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Challan No.</th>
                  <th className="text-left px-4 py-3">Student</th>
                  <th className="text-left px-4 py-3">Class</th>
                  <th className="text-left px-4 py-3">Month</th>
                  <th className="text-right px-4 py-3">Total Fee</th>
                  <th className="text-right px-4 py-3">Paid/Disc</th>
                  <th className="text-right px-4 py-3">Remaining Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredDues.map(d => {
                  const remaining = d.balance || 0;
                  return (
                    <tr key={d._id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.challanNo}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {d.student?.fullName}
                        {d.student?.fatherName && <span className="text-slate-500 text-xs block font-normal">s/o {d.student.fatherName}</span>}
                        <span className="text-slate-400 text-xs block font-normal">{d.student?.studentId}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{d.student?.class} {d.student?.section || ''}</td>
                      <td className="px-4 py-3 text-slate-600">{d.dueMonthRange || d.feeMonth} {d.feeYear}</td>
                      <td className="px-4 py-3 text-right">Rs. {d.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-400">Rs. {((d.amountPaid || 0) + (d.discount || 0)).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">Rs. {remaining.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
