import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, Sector, RadialBarChart, RadialBar,
} from 'recharts';
import {
  Users, UserCog, DollarSign, AlertCircle, UserPlus,
  GraduationCap, TrendingUp, BadgeDollarSign, BookOpen,
  ChevronRight, RefreshCw, Landmark, Percent, Layers, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import {
  getDashboardStats, getMonthlyFees, getClassDistribution,
  getFeeStatus, getRecentPayments,
} from '../api/dashboard';
import { StatCard, Skeleton } from '../components/DashboardWidgets';

// ─── Color palettes ───────────────────────────────────────────────
const PIE_COLORS = { Paid: '#10b981', Unpaid: '#ef4444', Partial: '#f59e0b', Overdue: '#f43f5e' };
const CLASS_COLORS = ['#3b82f6','#8b5cf6','#06b6d4','#f59e0b','#ec4899','#10b981','#f97316','#6366f1'];

// ─── Custom tooltip for bar chart ────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-solid backdrop-blur-md border border-line rounded-2xl shadow-2xl p-4 text-xs t-body">
      <p className="font-bold t-body mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
          <span>{p.name}:</span>
          <span className="font-extrabold t-body">Rs. {p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Custom active shape for donut ───────────────────────────────
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#ffffff" className="text-sm font-extrabold" fontSize={14}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#94a3b8" className="text-[10px] font-bold uppercase tracking-wider">
        {value} challans
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={innerRadius - 2} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

// ─── Status badge ─────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    Paid:    'bg-ok-soft t-ok border-ok-border',
    Unpaid:  'bg-bad-soft t-bad border-bad-border',
    Partial: 'bg-warn-soft t-warn border-warn-border',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[status] || 'bg-surface-3 t-muted border-line'}`}>
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

  // Dashboard Tab Selection: 'blank' | 'academics' | 'finance'
  const [activeDashboard, setActiveDashboard] = useState('blank');

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

  // Derived Analytics Metrics
  const collected = stats?.fees?.collectedThisMonth || 0;
  const due = stats?.fees?.dueThisMonth || 0;
  const totalBill = stats?.fees?.totalAmount || (collected + due) || 1;
  const collectionEfficiency = Math.round((collected / totalBill) * 100);

  const activeStudents = stats?.students?.active || 0;
  const activeTeachers = stats?.employees?.teachers || 1;
  const studentTeacherRatio = Math.round(activeStudents / activeTeachers);

  const outstanding = stats?.fees?.totalOutstandingDues || 0;
  const burdenRatio = collected > 0 ? Math.round((outstanding / collected) * 100) : 0;

  const radialData = [
    { name: 'Target', value: 100, fill: 'rgba(255,255,255,0.05)' },
    { name: 'Collection', value: Math.min(collectionEfficiency, 100), fill: 'url(#efficiencyGrad)' }
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Page header / Welcome Banner ────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-900/60 via-indigo-950/80 to-[#0b0f19] border border-line p-6 md:p-8 shadow-[0_10px_35px_rgba(0,0,0,0.3)]">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse-glow" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-brand rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse-glow delay-1000" />
        </div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="px-3 py-1 rounded-full bg-brand-soft border border-brand-border text-xs font-bold t-brand uppercase tracking-widest">
              Live Console
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold t-body mt-3 tracking-tight">
              Good {getGreeting()}, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="t-muted text-sm mt-1">
              Select or synchronize metrics view.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {activeDashboard !== 'blank' && (
              <button
                onClick={() => setActiveDashboard('blank')}
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider t-muted hover:t-body bg-surface-2 hover:bg-surface-3 border border-line rounded-xl px-4 py-2.5 transition"
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            <button
              onClick={fetchAll}
              className="btn btn-ghost hover:t-body shadow-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Synchronize
            </button>
          </div>
        </div>
      </div>

      {/* ── DEFAULT BLANK / DASHBOARD SELECTOR VIEW ────── */}
      {activeDashboard === 'blank' && (
        <div className="flex flex-col items-center justify-center py-10 space-y-8 animate-fade-in-up">
          <div className="text-center max-w-lg">
            <h2 className="text-xl font-bold tracking-tight t-body uppercase">Analytics Dashboard Hub</h2>
            <p className="t-muted text-xs mt-1.5 leading-relaxed font-semibold uppercase tracking-wider">
              Please choose a dashboard below to inspect live school metrics:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
            {/* Academics Selector Card */}
            <button
              onClick={() => setActiveDashboard('academics')}
              className="glass-card text-left p-8 rounded-3xl border border-line hover:border-brand-border flex flex-col justify-between h-56 transition-all group duration-300"
            >
              <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-2xl p-4 w-14 h-14 flex items-center justify-center shadow-lg shadow-blue-500/10 group-hover:scale-110 transition duration-300">
                <GraduationCap className="t-body w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight t-body uppercase group-hover:t-brand transition-colors">Academics Hub</h3>
                <p className="t-muted text-xs mt-1 font-medium leading-relaxed">
                  Analyze active student registrations, class demographics, teacher ratios, and enrollment health lines.
                </p>
              </div>
            </button>

            {/* Finance Selector Card */}
            <button
              onClick={() => setActiveDashboard('finance')}
              className="glass-card text-left p-8 rounded-3xl border border-line hover:border-ok-border flex flex-col justify-between h-56 transition-all group duration-300"
            >
              <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-2xl p-4 w-14 h-14 flex items-center justify-center shadow-lg shadow-emerald-500/10 group-hover:scale-110 transition duration-300">
                <Landmark className="t-body w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight t-body uppercase group-hover:t-ok transition-colors">Financial Hub</h3>
                <p className="t-muted text-xs mt-1 font-medium leading-relaxed">
                  Monitor collection efficiency, fee invoices status, cumulative outstanding dues, and payment logs.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── ACADEMICS DASHBOARD VIEW ──────────────────── */}
      {activeDashboard === 'academics' && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-line pb-3">
            <span className="text-xs font-bold uppercase tracking-widest t-brand flex items-center gap-1.5">
              <GraduationCap size={16} /> Academics Metrics Dashboard
            </span>
            <div className="flex gap-2">
              <button onClick={() => setActiveDashboard('finance')} className="text-[10px] font-bold uppercase tracking-wider t-muted hover:t-body bg-surface-2 px-3 py-1.5 rounded-xl border border-line">
                Switch to Finance
              </button>
            </div>
          </div>

          {/* Metric cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                sub="Registered this month"
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
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card card-lg lg:col-span-2 p-6 flex flex-col justify-between">
              <div>
                <h2 className="font-bold t-body text-sm tracking-wider uppercase">Class Demographics</h2>
                <p className="text-xs t-muted mt-0.5">Active student distribution breakdown</p>
              </div>
              {loading ? (
                <Skeleton className="h-56 w-full" />
              ) : classDist.length === 0 ? (
                <div className="h-56 flex items-center justify-center t-faint text-xs flex-col gap-2">
                  <BookOpen size={32} className="t-muted" />
                  <span>No student data yet</span>
                </div>
              ) : (
                <div className="h-64 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={classDist} cx="50%" cy="50%" outerRadius={75} dataKey="count" nameKey="class" label={({ class: c, count }) => `${c} (${count})`} labelLine={false} fontSize={9} fontWeight={600}>
                        {classDist.map((_, i) => <Cell key={i} fill={CLASS_COLORS[i % CLASS_COLORS.length]} className="outline-none" />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, `Class ${n}`]} contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Ratios Insights */}
            <div className="card card-lg p-6 flex flex-col justify-between">
              <div>
                <h2 className="font-bold t-body text-sm tracking-wider uppercase">Student to Teacher Ratio</h2>
                <p className="text-xs t-muted mt-0.5">Calculated metric compared to active teaching headcount.</p>
              </div>
              
              <div className="flex flex-col items-center justify-center my-6">
                <div className="w-32 h-32 rounded-full border-4 border-dashed border-brand-border flex flex-col items-center justify-center shadow-lg shadow-blue-500/5 animate-pulse-glow">
                  <span className="text-3xl font-extrabold t-brand">{studentTeacherRatio}:1</span>
                  <span className="text-[8px] uppercase tracking-widest t-muted mt-1 font-bold">ratio</span>
                </div>
              </div>

              <div className="space-y-3 border-t border-line pt-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="t-muted">Active Teachers</span>
                  <span className="font-bold t-body">{stats?.employees?.teachers || 0}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="t-muted">Active Students</span>
                  <span className="font-bold t-body">{stats?.students?.active || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FINANCE DASHBOARD VIEW ────────────────────── */}
      {activeDashboard === 'finance' && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-line pb-3">
            <span className="text-xs font-bold uppercase tracking-widest t-ok flex items-center gap-1.5">
              <Landmark size={16} /> Financial Metrics Dashboard
            </span>
            <div className="flex gap-2">
              <button onClick={() => setActiveDashboard('academics')} className="text-[10px] font-bold uppercase tracking-wider t-muted hover:t-body bg-surface-2 px-3 py-1.5 rounded-xl border border-line">
                Switch to Academics
              </button>
            </div>
          </div>

          {/* Metric cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StatCard
                title="Fee Collected"
                value={fmtRs(stats?.fees?.collectedThisMonth)}
                sub="Month collections"
                icon={BadgeDollarSign}
                color="green"
              />
              <StatCard
                title="Outstanding Dues"
                value={fmtRs(stats?.fees?.totalOutstandingDues)}
                sub="Cumulative balance"
                icon={AlertCircle}
                color="red"
              />
            </div>
          )}

          {/* Monthly Collection Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card card-lg lg:col-span-2 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-bold t-body text-sm tracking-wider uppercase">Monthly Fee Collection</h2>
                  <p className="text-xs t-muted mt-0.5">Collections vs balances over 12 billing periods</p>
                </div>
                <TrendingUp size={16} className="t-brand" />
              </div>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthly} barSize={8} barGap={4}>
                    <defs>
                      <linearGradient id="barCollectedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.25}/>
                      </linearGradient>
                      <linearGradient id="barDueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f87171" stopOpacity={0.95}/>
                        <stop offset="100%" stopColor="#f87171" stopOpacity={0.25}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip content={<BarTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                    <Bar dataKey="collected" name="Collected" fill="url(#barCollectedGrad)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="due" name="Outstanding" fill="url(#barDueGrad)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Collection Efficiency Card */}
            <div className="card card-lg p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold t-body text-sm tracking-wider uppercase">Collection Efficiency</h2>
                  <Percent size={16} className="t-brand" />
                </div>
                <p className="text-xs t-muted">Monthly receipt rate over total billed amount.</p>
              </div>

              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="flex items-center justify-center my-2 relative">
                  <ResponsiveContainer width="100%" height={150}>
                    <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={12} data={radialData} startAngle={90} endAngle={-270}>
                      <defs>
                        <linearGradient id="efficiencyGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10b981"/>
                          <stop offset="100%" stopColor="#3b82f6"/>
                        </linearGradient>
                      </defs>
                      <RadialBar background dataKey="value" cornerRadius={6} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold t-body tracking-tight">{collectionEfficiency}%</span>
                    <span className="text-[9px] uppercase font-bold tracking-widest t-muted mt-0.5">collected</span>
                  </div>
                </div>
              )}

              <div className="space-y-3 border-t border-line pt-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="t-muted flex items-center gap-1"><Layers size={12}/> Dues Burden Rate</span>
                  <span className={`font-extrabold px-2 py-0.5 rounded-lg border ${burdenRatio > 100 ? 't-bad bg-bad-soft border-bad-border' : 't-warn bg-warn-soft border-warn-border'}`}>
                    {burdenRatio}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fee Status Pie & Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card card-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold t-body text-sm tracking-wider uppercase">Fee Status</h2>
                  <p className="text-xs t-muted mt-0.5">Current month invoice categories</p>
                </div>
                <DollarSign size={16} className="t-ok" />
              </div>
              {loading ? (
                <Skeleton className="h-56 w-full" />
              ) : feeStatus.every(f => f.value === 0) ? (
                <div className="h-56 flex items-center justify-center t-faint text-xs flex-col gap-2">
                  <BadgeDollarSign size={32} className="t-muted" />
                  <span>No fee records this month</span>
                </div>
              ) : (
                <>
                  <div className="h-48 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={feeStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={72}
                          dataKey="value"
                          activeIndex={activeIndex}
                          activeShape={renderActiveShape}
                          onMouseEnter={(_, i) => setActiveIndex(i)}
                        >
                          {feeStatus.map((entry) => (
                            <Cell key={entry.name} fill={PIE_COLORS[entry.name]} className="outline-none" />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-4">
                    {feeStatus.map((f) => (
                      <div key={f.name} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[f.name] }} />
                        <span className="t-muted">{f.name}:</span>
                        <span className="t-body font-extrabold">{f.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Recent Payments table inside Dashboard */}
            <div className="card card-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold t-body text-sm tracking-wider uppercase">Recent Receipts</h2>
                  <p className="text-xs t-muted mt-0.5">Last 5 fee collections</p>
                </div>
                <Link to="/fees" className="text-xs font-bold uppercase tracking-wider t-brand hover:t-brand flex items-center gap-0.5 transition">
                  View All <ChevronRight size={12} />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : recent.length === 0 ? (
                <div className="h-56 flex items-center justify-center t-faint text-xs flex-col gap-2">
                  <DollarSign size={32} className="t-muted" />
                  <span>No payments recorded yet</span>
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                  {recent.map((r) => (
                    <div key={r._id} className="flex items-center justify-between p-3 rounded-2xl bg-surface-2 border border-line hover:border-blue-500/10 transition-colors">
                      <div className="min-w-0">
                        <p className="text-xs font-bold t-body truncate">{r.student?.fullName || '—'}</p>
                        <p className="text-[10px] t-muted mt-0.5 font-medium">
                          Class {r.student?.class || '—'} {r.student?.section ? `(${r.student.section})` : ''} • {r.feeMonth} {r.feeYear}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black t-body">Rs. {r.amountPaid?.toLocaleString()}</p>
                        <div className="mt-1"><StatusBadge status={r.status} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────── */}
      <p className="text-center text-[10px] font-bold uppercase tracking-wider t-muted pt-4">
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
