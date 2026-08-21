import { useState, useEffect, useMemo } from 'react';
import { getDues } from '../api/fees';
import { getClasses } from '../api/students';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { AlertCircle, Download, Search, Printer, Layers, Landmark } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const monthlyDueOf = (d) =>
  d.monthlyBalance === undefined || d.monthlyBalance === null ? (d.balance || 0) : d.monthlyBalance;
const annualDueOf = (d) =>
  d.annualBalance === undefined || d.annualBalance === null ? 0 : d.annualBalance;

const getRemainingMonths = (d) => {
  const mDue = monthlyDueOf(d);
  if (mDue <= 0) return '—';
  if (!d.paidUpToMonth) return d.dueMonthRange || d.feeMonth;
  
  const startIndex = MONTHS.indexOf(d.paidUpToMonth);
  const endIndex = MONTHS.indexOf(d.feeMonth);
  
  if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
    return `${d.feeMonth} ${d.feeYear}`;
  }
  
  const firstUnpaidMonth = MONTHS[startIndex + 1];
  if (firstUnpaidMonth === d.feeMonth) {
    return `${d.feeMonth} ${d.feeYear}`;
  }
  return `${firstUnpaidMonth} - ${d.feeMonth} ${d.feeYear}`;
};

export default function DuesPage() {
  const { currentCampus, currentSession, campuses, sessions } = useAppContext();
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  // Filters
  const [filterClass, setFilterClass] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [search, setSearch] = useState('');

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

  const totals = useMemo(() => filteredDues.reduce((acc, d) => ({
    monthly: acc.monthly + monthlyDueOf(d),
    annual: acc.annual + annualDueOf(d),
    all: acc.all + (d.balance || 0),
  }), { monthly: 0, annual: 0, all: 0 }), [filteredDues]);

  // Dynamic Class-wise Dues Analysis
  const classDuesAnalysis = useMemo(() => {
    const map = {};
    filteredDues.forEach(d => {
      const cls = d.student?.class || 'Unknown';
      map[cls] = (map[cls] || 0) + (d.balance || 0);
    });
    return Object.entries(map)
      .map(([className, amount]) => ({ className, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4); // Display top 4 classes with highest dues
  }, [filteredDues]);

  const exportCSV = () => {
    const headers = ['Challan No', 'Student ID', 'Student Name', 'Father Name', 'Class', 'Remaining Months', 'Monthly Due', 'Annual Due', 'Total Outstanding'];
    const rows = filteredDues.map(d => {
      const remaining = d.balance || 0;
      return [
        d.challanNo, d.student?.studentId, d.student?.fullName, d.student?.fatherName, `${d.student?.class} ${d.student?.section || ''}`,
        getRemainingMonths(d), monthlyDueOf(d), annualDueOf(d), remaining
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
      return `
        <tr>
          <td class="c">${i + 1}</td>
          <td class="mono">${escapeHtml(d.challanNo)}</td>
          <td>${escapeHtml(d.student?.studentId)}</td>
          <td>${escapeHtml(d.student?.fullName)}${d.student?.fatherName ? `<br/><span class="sub">s/o ${escapeHtml(d.student.fatherName)}</span>` : ''}</td>
          <td>${escapeHtml(`${d.student?.class || ''} ${d.student?.section || ''}`)}</td>
          <td>${escapeHtml(getRemainingMonths(d))}</td>
          <td class="r">${monthlyDueOf(d).toLocaleString()}</td>
          <td class="r">${annualDueOf(d).toLocaleString()}</td>
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
              <th>Remaining Months</th>
              <th class="r">Monthly Due</th>
              <th class="r">Annual Due</th>
              <th class="r">Total Outstanding</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr>
              <td colspan="6" class="r">Total Outstanding</td>
              <td class="r">Rs. ${totals.monthly.toLocaleString()}</td>
              <td class="r">Rs. ${totals.annual.toLocaleString()}</td>
              <td class="r due">Rs. ${totals.all.toLocaleString()}</td>
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
    setTimeout(() => win.print(), 300);
  };

  const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold t-body tracking-tight uppercase">Outstanding Dues</h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">{filteredDues.length} matching unpaid invoices</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={printReport} disabled={filteredDues.length === 0}
            className="btn btn-ghost disabled:opacity-50"
          >
            <Printer size={14} /> Print Report
          </button>
          <button onClick={exportCSV} disabled={filteredDues.length === 0}
            className="btn btn-ghost disabled:opacity-50"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Screen Analytics: Financial Summary Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Landmark className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Monthly Dues</p>
            <p className="text-xl sm:text-2xl font-extrabold t-brand mt-0.5 tracking-tight break-words">{fmtRs(totals.monthly)}</p>
            <p className="t-faint text-xs mt-1 font-medium">Tuition and transportation limits</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Layers className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Annual Dues</p>
            <p className="text-xl sm:text-2xl font-extrabold t-brand mt-0.5 tracking-tight break-words">{fmtRs(totals.annual)}</p>
            <p className="t-faint text-xs mt-1 font-medium">Class enrollment annual dues</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="bg-gradient-to-tr from-rose-600/80 to-rose-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
              <AlertCircle className="t-body w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Total Outstanding</p>
              <p className="text-xl sm:text-2xl font-extrabold t-bad mt-0.5 tracking-tight break-words">{fmtRs(totals.all)}</p>
              <p className="t-faint text-xs mt-1 font-medium">Cumulative unpaid burden</p>
            </div>
          </div>
        </div>
      </div>

      {/* Screen Analytics: Class Dues Breakdown */}
      {classDuesAnalysis.length > 0 && (
        <div className="card card-lg p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider t-muted mb-4">Highest Outstanding Balances by Class</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {classDuesAnalysis.map(cd => {
              const pct = totals.all > 0 ? Math.round((cd.amount / totals.all) * 100) : 0;
              return (
                <div key={cd.className} className="bg-surface-2 border border-line rounded-2xl p-4">
                  <div className="flex justify-between items-center text-xs font-bold mb-2">
                    <span className="t-muted">Class {cd.className}</span>
                    <span className="t-bad">{pct}% share</span>
                  </div>
                  <p className="text-sm font-black t-body">{fmtRs(cd.amount)}</p>
                  <div className="w-full bg-surface-2 rounded-full h-1.5 mt-2.5 overflow-hidden">
                    <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card card-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs flex items-center gap-2">
          <Search size={14} className="t-faint" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student name, ID or receipt..." className="bg-transparent w-full t-body placeholder-faint focus:outline-none font-medium" />
        </div>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer min-w-32">
          <option value="">All Months</option>
          {MONTHS.map(m => <option key={m} className="bg-surface-2">{m}</option>)}
        </select>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer min-w-32">
          <option value="">All Classes</option>
          {classes.map(c => <option key={c} value={c} className="bg-surface-2">Class {c}</option>)}
        </select>
      </div>

      {/* Table List */}
      <div className="card card-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="animate-spin w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full mx-auto" />
            <p className="t-muted text-xs mt-3 uppercase font-bold tracking-wider">Compiling outstanding totals...</p>
          </div>
        ) : filteredDues.length === 0 ? (
          <div className="p-16 text-center t-faint flex flex-col items-center">
            <AlertCircle size={40} className="t-muted mb-3" />
            <p className="t-muted font-bold uppercase tracking-wider text-sm">No outstanding dues</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-xs text-left rtable">
              <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4">Challan No.</th>
                  <th className="px-5 py-4">Student</th>
                  <th className="px-5 py-4">Class</th>
                  <th className="px-5 py-4">Remaining Months</th>
                  <th className="text-right px-5 py-4">Monthly Due</th>
                  <th className="text-right px-5 py-4">Annual Due</th>
                  <th className="text-right px-5 py-4">Total Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line t-muted">
                {filteredDues.map(d => {
                  const remaining = d.balance || 0;
                  const monthlyDue = monthlyDueOf(d);
                  const annualDue = annualDueOf(d);
                  return (
                    <tr key={d._id} className="hover:bg-surface-2 transition">
                      <td data-label="Challan No." className="px-5 py-4 font-mono font-bold t-faint">{d.challanNo}</td>
                      <td data-label="Student" className="px-5 py-4 md:whitespace-nowrap">
                        <div>
                          <div className="font-bold t-body">{d.student?.fullName}</div>
                          {d.student?.fatherName && <div className="text-[10px] t-muted mt-0.5">s/o {d.student.fatherName}</div>}
                          <div className="text-[10px] font-mono t-faint mt-0.5">{d.student?.studentId}</div>
                        </div>
                      </td>
                      <td data-label="Class" className="px-5 py-4 t-muted font-medium">Class {d.student?.class} {d.student?.section || ''}</td>
                      <td data-label="Remaining Months" className="px-5 py-4 t-muted font-semibold">{getRemainingMonths(d)}</td>
                      <td data-label="Monthly Due" className="px-5 py-4 text-right font-medium">
                        {monthlyDue > 0 ? `Rs. ${monthlyDue.toLocaleString()}` : <span className="t-muted">—</span>}
                      </td>
                      <td data-label="Annual Due" className="px-5 py-4 text-right font-medium t-brand">
                        {annualDue > 0 ? `Rs. ${annualDue.toLocaleString()}` : <span className="t-muted">—</span>}
                      </td>
                      <td data-label="Total Outstanding" className="px-5 py-4 text-right font-black t-bad">Rs. {remaining.toLocaleString()}</td>
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
