import { useState, useEffect, useMemo } from 'react';
import { getDues } from '../api/fees';
import { getClasses } from '../api/students';
import toast from 'react-hot-toast';
import { AlertCircle, Download, Search } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function DuesPage() {
  const [dues, setDues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  // Filters
  const [filterClass, setFilterClass] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getClasses().then(r => setClasses(r.data)).catch(() => {});
    
    setLoading(true);
    getDues()
      .then(res => setDues(res.data))
      .catch(() => toast.error('Failed to load dues'))
      .finally(() => setLoading(false));
  }, []);

  const filteredDues = useMemo(() => {
    return dues.filter(d => {
      const matchClass = filterClass ? d.student?.class === filterClass : true;
      const matchMonth = filterMonth ? d.feeMonth === filterMonth : true;
      const matchSearch = search ? (
        d.student?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        d.student?.studentId?.toLowerCase().includes(search.toLowerCase()) ||
        d.receiptNumber?.toLowerCase().includes(search.toLowerCase())
      ) : true;
      return matchClass && matchMonth && matchSearch;
    });
  }, [dues, filterClass, filterMonth, search]);

  const totalOutstanding = filteredDues.reduce((acc, curr) => acc + (curr.totalAmount - (curr.paidAmount || 0) - (curr.discount || 0)), 0);

  const exportCSV = () => {
    const headers = ['Receipt No', 'Student ID', 'Student Name', 'Class', 'Month', 'Total Fee', 'Paid', 'Discount', 'Remaining Due'];
    const rows = filteredDues.map(d => {
      const remaining = d.totalAmount - (d.paidAmount || 0) - (d.discount || 0);
      return [
        d.receiptNumber, d.student?.studentId, d.student?.fullName, `${d.student?.class} ${d.student?.section || ''}`,
        `${d.feeMonth} ${d.feeYear}`, d.totalAmount, d.paidAmount || 0, d.discount || 0, remaining
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'Outstanding_Dues.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Outstanding Dues</h1>
          <p className="text-slate-400 text-sm mt-0.5">{filteredDues.length} records found</p>
        </div>
        <button onClick={exportCSV} disabled={filteredDues.length === 0}
          className="flex items-center gap-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2 transition shadow-sm font-medium hover:bg-slate-50 disabled:opacity-50">
          <Download size={14} /> Export CSV
        </button>
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
                  <th className="text-left px-4 py-3">Receipt No.</th>
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
                  const remaining = d.totalAmount - (d.paidAmount || 0) - (d.discount || 0);
                  return (
                    <tr key={d._id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.receiptNumber}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{d.student?.fullName} <span className="text-slate-400 text-xs block">{d.student?.studentId}</span></td>
                      <td className="px-4 py-3 text-slate-600">{d.student?.class} {d.student?.section || ''}</td>
                      <td className="px-4 py-3 text-slate-600">{d.feeMonth} {d.feeYear}</td>
                      <td className="px-4 py-3 text-right">Rs. {d.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-400">Rs. {((d.paidAmount || 0) + (d.discount || 0)).toLocaleString()}</td>
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
