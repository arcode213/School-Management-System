// Reusable stat card component
export function StatCard({ title, value, sub, icon: Icon, color }) {
  const colors = {
    blue:   { iconBg: 'from-blue-600/80 to-blue-400/80',   text: 'text-blue-400',   border: 'hover:border-blue-500/20' },
    green:  { iconBg: 'from-emerald-600/80 to-emerald-400/80', text: 'text-emerald-400', border: 'hover:border-emerald-500/20' },
    purple: { iconBg: 'from-purple-600/80 to-purple-400/80', text: 'text-purple-400', border: 'hover:border-purple-500/20' },
    orange: { iconBg: 'from-orange-600/80 to-orange-400/80', text: 'text-orange-400', border: 'hover:border-orange-500/20' },
    red:    { iconBg: 'from-rose-600/80 to-rose-400/80',    text: 'text-rose-400',    border: 'hover:border-rose-500/20' },
    teal:   { iconBg: 'from-teal-600/80 to-teal-400/80',   text: 'text-teal-400',   border: 'hover:border-teal-500/20' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`glass-card p-5 flex items-start gap-4 ${c.border}`}>
      <div className={`bg-gradient-to-tr ${c.iconBg} rounded-xl p-3 flex-shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.05)]`}>
        <Icon className="text-white w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{title}</p>
        <p className={`text-2xl font-extrabold ${c.text} mt-0.5 tracking-tight`}>{value ?? '—'}</p>
        {sub && <p className="text-slate-500 text-xs mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

// Section heading
export function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-bold tracking-wider uppercase text-slate-300">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// Loading skeleton
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-800/50 border border-white/5 rounded-2xl ${className}`} />;
}
