import { useState, useEffect, useMemo, useRef } from 'react';
import * as xlsx from 'xlsx';
import { getDues } from '../api/fees';
import { getClasses } from '../api/students';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { AlertCircle, Download, Search, Printer, Layers, Landmark, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { MONTHS, parseDueMonthRange, formatDueMonths, formatMonthYear } from '../utils/feeMonths';
import { formatClassName } from '../utils/constants';

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
  
  if (!d.paidUpToMonth) {
    return formatDueMonths(d.dueMonthRange, d.feeMonth, d.feeYear, d);
  }

  const parsedRange = parseDueMonthRange(d.dueMonthRange, d.feeMonth, d.feeYear);
  const absStart = parsedRange.startYear * 12 + MONTHS.indexOf(parsedRange.startMonth);
  const absEnd = parsedRange.endYear * 12 + MONTHS.indexOf(parsedRange.endMonth);
  
  let absPaidUp = -1;
  for (let m = absStart; m <= absEnd; m++) {
    if (MONTHS[m % 12] === d.paidUpToMonth) {
      absPaidUp = m;
      break;
    }
  }

  if (absPaidUp === -1 || absPaidUp + 1 > absEnd) {
    return `${d.feeMonth} ${d.feeYear}`;
  }

  const firstUnpaidAbs = absPaidUp + 1;
  const firstUnpaidMonth = MONTHS[firstUnpaidAbs % 12];
  const firstUnpaidYear = Math.floor(firstUnpaidAbs / 12);

  if (firstUnpaidAbs === absEnd) {
    return `${d.feeMonth} ${d.feeYear}`;
  }

  return `${formatMonthYear(firstUnpaidMonth, firstUnpaidYear)} to ${formatMonthYear(parsedRange.endMonth, parsedRange.endYear)}`;
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

  // Print menu state
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const printMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (printMenuRef.current && !printMenuRef.current.contains(e.target)) {
        setShowPrintMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const exportExcel = () => {
    if (filteredDues.length === 0) return;

    const data = [
      ['Challan No.', 'Student ID', 'Student Name', 'Father Name', 'Class', 'Section', 'Remaining Months', 'Monthly Due (Rs.)', 'Annual Due (Rs.)', 'Total Outstanding (Rs.)']
    ];

    filteredDues.forEach((d) => {
      const cls = formatClassName(d.student?.class);
      const sec = d.student?.section || '';
      const monthlyDue = monthlyDueOf(d);
      const annualDue = annualDueOf(d);
      const totalRemaining = d.balance || 0;
      const remainingMonths = getRemainingMonths(d);

      data.push([
        String(d.challanNo || ''),
        String(d.student?.studentId || ''),
        String(d.student?.fullName || ''),
        String(d.student?.fatherName || ''),
        String(cls || ''),
        String(sec || ''),
        String(remainingMonths || ''),
        monthlyDue,
        annualDue,
        totalRemaining
      ]);
    });

    // Summary row
    data.push([
      'TOTAL', '', '', '', '', '', '',
      totals.monthly,
      totals.annual,
      totals.all
    ]);

    const ws = xlsx.utils.aoa_to_sheet(data);

    // Set explicit cell types:
    // Columns 0-6: String type ('s') to prevent Excel from interpreting classes (e.g. 1, 1-A), IDs, or date ranges as Times/Dates.
    // Columns 7-9: Numeric type ('n') with standard thousand separator format.
    const range = xlsx.utils.decode_range(ws['!ref']);
    for (let R = 1; R <= range.e.r; ++R) {
      for (let C = 0; C <= 6; ++C) {
        const cellRef = xlsx.utils.encode_cell({ r: R, c: C });
        if (ws[cellRef]) {
          ws[cellRef].t = 's';
        }
      }
      for (let C = 7; C <= 9; ++C) {
        const cellRef = xlsx.utils.encode_cell({ r: R, c: C });
        if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
          ws[cellRef].t = 'n';
          ws[cellRef].z = '#,##0';
        }
      }
    }

    // Set auto-proportioned readable column widths
    ws['!cols'] = [
      { wch: 16 }, // Challan No.
      { wch: 14 }, // Student ID
      { wch: 24 }, // Student Name
      { wch: 22 }, // Father Name
      { wch: 12 }, // Class
      { wch: 10 }, // Section
      { wch: 28 }, // Remaining Months
      { wch: 18 }, // Monthly Due
      { wch: 18 }, // Annual Due
      { wch: 22 }, // Total Outstanding
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Outstanding Dues');
    xlsx.writeFile(wb, 'Outstanding_Dues.xlsx');
    toast.success('Dues report exported to Excel');
  };

  const printReport = (orientation = 'portrait') => {
    if (filteredDues.length === 0) return;

    const campusName = campuses.find(c => c._id === currentCampus)?.name || 'All Campuses';
    const sessionName = sessions.find(s => s._id === currentSession)?.name || '';
    const printedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const appliedFilters = [
      filterClass && `Class: ${formatClassName(filterClass)}`,
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
          <td>${escapeHtml(`${formatClassName(d.student?.class)} ${d.student?.section || ''}`.trim())}</td>
          <td>${escapeHtml(getRemainingMonths(d))}</td>
          <td class="r">${monthlyDueOf(d).toLocaleString()}</td>
          <td class="r">${annualDueOf(d).toLocaleString()}</td>
          <td class="r due">${remaining.toLocaleString()}</td>
        </tr>`;
    }).join('');

    const isLandscape = orientation === 'landscape';

    const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Outstanding Dues Report (${isLandscape ? 'Landscape' : 'Portrait'})</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: ${orientation}; margin: 10mm; }
          body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 16px; }
          .head { text-align: center; border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 6px; }
          .head h1 { margin: 0; font-size: ${isLandscape ? '20px' : '18px'}; }
          .head h2 { margin: 4px 0 0; font-size: ${isLandscape ? '14px' : '13px'}; font-weight: 600; }
          .meta { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin: 8px 0 14px; }
          .filters { font-size: 11px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: ${isLandscape ? '11px' : '10px'}; }
          th, td { border: 1px solid #cbd5e1; padding: ${isLandscape ? '5px 7px' : '4px 6px'}; text-align: left; vertical-align: top; }
          thead th { background: #f1f5f9; text-transform: uppercase; font-size: ${isLandscape ? '10px' : '9px'}; letter-spacing: .04em; }
          td.r, th.r { text-align: right; }
          td.c, th.c { text-align: center; }
          td.mono { font-family: 'Courier New', monospace; font-size: ${isLandscape ? '11px' : '9.5px'}; }
          td.due { font-weight: bold; color: #b91c1c; }
          td.sub, .sub { color: #64748b; font-weight: normal; font-size: 9px; }
          tfoot td { font-weight: bold; background: #fef2f2; font-size: ${isLandscape ? '12px' : '11px'}; }
          .foot { margin-top: 18px; font-size: 10px; color: #94a3b8; text-align: center; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="head">
          <h1>${escapeHtml(campusName)}</h1>
          <h2>Outstanding Dues Report${sessionName ? ` — Session ${escapeHtml(sessionName)}` : ''}</h2>
        </div>
        <div class="meta">
          <span class="filters">${appliedFilters || 'All records'}</span>
          <span>Printed: ${printedOn}&nbsp;&nbsp;|&nbsp;&nbsp;${filteredDues.length} record(s)&nbsp;&nbsp;|&nbsp;&nbsp;Orientation: ${isLandscape ? 'Landscape' : 'Portrait'}</span>
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
          {/* Print Dropdown with Orientation Selection */}
          <div className="relative inline-block" ref={printMenuRef}>
            <button 
              type="button"
              onClick={() => setShowPrintMenu(prev => !prev)} 
              disabled={filteredDues.length === 0}
              className="btn btn-ghost disabled:opacity-50 flex items-center gap-1.5"
              title="Print Dues Report"
            >
              <Printer size={14} /> 
              <span>Print Report</span>
              <ChevronDown size={13} className={`transition-transform duration-200 ${showPrintMenu ? 'rotate-180' : ''}`} />
            </button>

            {showPrintMenu && (
              <div className="absolute right-0 mt-1.5 w-52 bg-solid border border-line rounded-xl shadow-2xl z-50 py-1.5 animate-fade-in">
                <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider t-faint border-b border-line">
                  Choose Orientation
                </div>
                <button
                  type="button"
                  onClick={() => { setShowPrintMenu(false); printReport('portrait'); }}
                  className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-surface-2 t-body transition text-xs font-medium"
                >
                  <div className="w-5 h-6 border-2 border-brand rounded-sm flex items-center justify-center text-[9px] font-bold t-brand">
                    P
                  </div>
                  <div>
                    <div className="font-semibold t-body">Portrait</div>
                    <div className="text-[10px] t-muted">Vertical (Standard A4)</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPrintMenu(false); printReport('landscape'); }}
                  className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-surface-2 t-body transition text-xs font-medium"
                >
                  <div className="w-6 h-5 border-2 border-brand rounded-sm flex items-center justify-center text-[9px] font-bold t-brand">
                    L
                  </div>
                  <div>
                    <div className="font-semibold t-body">Landscape</div>
                    <div className="text-[10px] t-muted">Horizontal (Wide tables)</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button onClick={exportExcel} disabled={filteredDues.length === 0}
            className="btn btn-ghost disabled:opacity-50 flex items-center gap-1.5"
            title="Export Excel Report"
          >
            <FileSpreadsheet size={14} /> Export Excel
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
                    <span className="t-muted">Class {formatClassName(cd.className)}</span>
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
          {classes.map(c => <option key={c} value={c} className="bg-surface-2">Class {formatClassName(c)}</option>)}
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
                      <td data-label="Class" className="px-5 py-4 t-muted font-medium">Class {formatClassName(d.student?.class)} {d.student?.section || ''}</td>
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
