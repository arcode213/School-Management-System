import { useState, useEffect } from 'react';
import { getFinancialReport } from '../api/reports';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setLoading(true);
    getFinancialReport({ year })
      .then(res => setReport(res.data))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false));
  }, [year]);

  const exportCSV = () => {
    if (!report) return;
    const headers = ['Month', 'Fees Collected (Revenue)', 'Salaries Paid (Expense)', 'Profit / Loss'];
    const rows = report.monthlyData.map(d => [d.month, d.revenue, d.expense, d.profit]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Financial_Report_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !report) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;
  }

  const { totalRevenue, totalExpense, netProfit } = report.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Financial Reports</h1>
          <p className="text-slate-400 text-sm mt-0.5">Summary for Year {year}</p>
        </div>
        <div className="flex gap-3">
          <select value={year} onChange={e => setYear(e.target.value)} className="border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm">
            {[year-2, year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV} className="flex items-center gap-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-2 transition shadow-sm font-medium hover:bg-slate-50">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center"><DollarSign size={16}/></div>
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Fees Collected</h2>
          </div>
          <p className="text-3xl font-bold text-slate-800">Rs. {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center"><TrendingDown size={16}/></div>
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Salaries Paid</h2>
          </div>
          <p className="text-3xl font-bold text-slate-800">Rs. {totalExpense.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><TrendingUp size={16}/></div>
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Net Profit</h2>
          </div>
          <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Rs. {netProfit.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 h-[400px]">
        <h2 className="text-lg font-semibold text-slate-800 mb-6">Monthly Financial Overview</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={report.monthlyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={v => `Rs.${v}`} />
            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend iconType="circle" />
            <Bar dataKey="revenue" name="Fees Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Salaries Paid" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
