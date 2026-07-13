import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, Sector,
} from 'recharts';
import {
  Users, UserCog, DollarSign, AlertCircle, UserPlus,
  GraduationCap, TrendingUp, BadgeDollarSign, BookOpen,
  ChevronRight, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import {
  getDashboardStats, getMonthlyFees, getClassDistribution,
  getFeeStatus, getRecentPayments,
} from '../api/dashboard';
import { StatCard, Skeleton } from '../components/DashboardWidgets';

// ─── Color palettes ───────────────────────────────────────────────
const PIE_COLORS = { Paid: '#22c55e', Unpaid: '#ef4444', Partial: '#f59e0b', Overdue: '#e11d48' };
const CLASS_COLORS = ['#3b82f6','#8b5cf6','#06b6d4','#f59e0b','#ec4899','#10b981','#f97316','#6366f1'];

// ─── Custom tooltip for bar chart ────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">Rs. {p.value.toLocaleString()}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Custom active shape for donut ───────────────────────────────
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#1e293b" className="text-sm font-bold" fontSize={14} fontWeight={700}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748b" fontSize={12}>
        {value} records
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 6} outerRadius={innerRadius - 2} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

// ─── Status badge ─────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    Paid:    'bg-green-100 text-green-700',
    Unpaid:  'bg-red-100 text-red-700',
    Partial: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
};

// ─── Rupee formatter ──────────────────────────────────────────────
const fmtRs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

export default function DashboardPage() {
  const { user } = useAuth();
  const { currentCampus, currentSession } = useAppContext();
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [classDist, setClassDist] = useState([]);
  const [feeStatus, setFeeStatus] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, m, c, f, r] = await Promise.all([
        getDashboardStats(),
        getMonthlyFees(),
        getClassDistribution(),
        getFeeStatus(),
        getRecentPayments(),
      ]);
      setStats(s.data);
      setMonthly(m.data);
      setClassDist(c.data);
      setFeeStatus(f.data);
      setRecent(r.data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (currentCampus && currentSession) fetchAll(); 
  }, [currentCampus, currentSession]);

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Here's what's happening in your school today.
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 bg-white border border-slate-200 rounded-xl px-3 py-2 transition hover:border-blue-300 shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            title="Total Students"
            value={stats?.students?.total ?? 0}
            sub={`${stats?.students?.active ?? 0} Active • ${stats?.students?.left ?? 0} Left`}
            icon={Users}
            color="blue"
          />
          <StatCard
            title="New Admissions"
            value={stats?.students?.newThisMonth ?? 0}
            sub="This month"
            icon={UserPlus}
            color="teal"
          />
          <StatCard
            title="Total Employees"
            value={stats?.employees?.total ?? 0}
            sub={`${stats?.employees?.teachers ?? 0} Teachers • ${stats?.employees?.staff ?? 0} Staff`}
            icon={UserCog}
            color="purple"
          />
          <StatCard
            title="Fee Collected"
            value={fmtRs(stats?.fees?.collectedThisMonth)}
            sub="This month"
            icon={BadgeDollarSign}
            color="green"
          />
          <StatCard
            title="Outstanding Dues"
            value={fmtRs(stats?.fees?.totalOutstandingDues)}
            sub="All time"
            icon={AlertCircle}
            color="red"
          />
        </div>
      )}

      {/* ── Charts Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Fee Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Monthly Fee Collection</h2>
              <p className="text-xs text-slate-400">Last 12 months — collected vs outstanding</p>
            </div>
            <TrendingUp size={16} className="text-blue-400" />
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthly} barSize={10} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={<BarTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="collected" name="Collected" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="due" name="Due" fill="#fca5a5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Fee Status Donut */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Fee Status</h2>
              <p className="text-xs text-slate-400">Current month breakdown</p>
            </div>
            <DollarSign size={16} className="text-green-400" />
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : feeStatus.every(f => f.value === 0) ? (
            <div className="h-56 flex items-center justify-center text-slate-400 text-xs flex-col gap-2">
              <BadgeDollarSign size={32} className="text-slate-300" />
              <span>No fee records this month</span>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={feeStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    dataKey="value"
                    activeIndex={activeIndex}
                    activeShape={renderActiveShape}
                    onMouseEnter={(_, i) => setActiveIndex(i)}
                  >
                    {feeStatus.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.name]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {feeStatus.map((f) => (
                  <div key={f.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[f.name] }} />
                    <span className="text-slate-500">{f.name}</span>
                    <span className="font-semibold text-slate-700">{f.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class-wise distribution */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Students by Class</h2>
              <p className="text-xs text-slate-400">Active students only</p>
            </div>
            <GraduationCap size={16} className="text-purple-400" />
          </div>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : classDist.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-xs flex-col gap-2">
              <BookOpen size={32} className="text-slate-300" />
              <span>No student data yet</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={classDist} cx="50%" cy="50%" outerRadius={75} dataKey="count" nameKey="class" label={({ class: c, count }) => `${c} (${count})`} labelLine={false} fontSize={10}>
                  {classDist.map((_, i) => <Cell key={i} fill={CLASS_COLORS[i % CLASS_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, `Class ${n}`]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Payments */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Recent Fee Payments</h2>
              <p className="text-xs text-slate-400">Last 5 transactions</p>
            </div>
            <Link to="/fees" className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5 transition">
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-xs flex-col gap-2">
              <DollarSign size={32} className="text-slate-300" />
              <span>No payments recorded yet</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 text-slate-400 font-medium">Student</th>
                    <th className="text-left py-2 text-slate-400 font-medium">Class</th>
                    <th className="text-left py-2 text-slate-400 font-medium">Month</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Paid</th>
                    <th className="text-right py-2 text-slate-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recent.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 font-medium text-slate-700">{r.student?.fullName || '—'}</td>
                      <td className="py-2.5 text-slate-500">{r.student?.class || '—'}</td>
                      <td className="py-2.5 text-slate-500">{r.feeMonth} {r.feeYear}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-700">Rs. {r.amountPaid?.toLocaleString()}</td>
                      <td className="py-2.5 text-right"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <p className="text-center text-xs text-slate-300 pt-2">
        Last updated: {lastRefresh.toLocaleTimeString()}
      </p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
