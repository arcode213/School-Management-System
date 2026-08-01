import { useState, useEffect, useMemo } from 'react';
import { getFinancialReport } from '../api/reports';
import { useAppContext } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, TrendingUp, TrendingDown, DollarSign, Percent, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const { currentCampus, currentSession } = useAppContext();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!currentCampus || !currentSession) return;
    setLoading(true);
    getFinancialReport({ year })
      .then(res => setReport(res.data))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false));
  }, [year, currentCampus, currentSession]);

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

  const netProfitMargin = useMemo(() => {
    if (!report) return 0;
    const rev = report.summary?.totalRevenue || 0;
    const net = report.summary?.netProfit || 0;
    return rev > 0 ? Math.round((net / rev) * 100) : 0;
  }, [report]);

  if (loading || !report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        <p className="text-xs uppercase font-bold tracking-wider mt-3">Compiling general ledger...</p>
      </div>
    );
  }

  const { totalRevenue, totalExpense, netProfit } = report.summary;
  const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Financial Analytics</h1>
          <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-wider">Summary and profit breakdown for Fiscal Year {year}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
            {[year-2, year-1, year, year+1].map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
          </select>
          <button onClick={exportCSV} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl px-4 py-2.5 transition">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Screen Analytics: Financial Summary Panels */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <DollarSign className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Fees Collected</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5 tracking-tight">{fmtRs(totalRevenue)}</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Billed revenue receipts</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-rose-600/80 to-rose-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <TrendingDown className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Salaries Paid</p>
            <p className="text-xl font-extrabold text-rose-400 mt-0.5 tracking-tight">{fmtRs(totalExpense)}</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Total payroll expenses</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <TrendingUp className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Net Profit</p>
            <p className={`text-xl font-extrabold mt-0.5 tracking-tight ${netProfit >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{fmtRs(netProfit)}</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Post-expense balance</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Percent className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Profit Margin</p>
            <p className="text-xl font-extrabold text-purple-400 mt-0.5 tracking-tight">{netProfitMargin}%</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Ratio of revenue retained</p>
          </div>
        </div>
      </div>

      {/* Recharts monthly financial overview */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl h-[400px]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-6">Monthly Revenue vs Payroll Overview</h2>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={report.monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barSize={8} barGap={4}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.95}/>
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.25}/>
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95}/>
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.25}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={v => `Rs.${v}`} />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.02)' }}
              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', color: '#fff', fontSize: '11px' }} 
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }} />
            <Bar dataKey="revenue" name="Revenue" fill="url(#revenueGrad)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="Salaries" fill="url(#expenseGrad)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
