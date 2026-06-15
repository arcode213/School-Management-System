// Reusable stat card component
export function StatCard({ title, value, sub, icon: Icon, color, trend }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-600',   text: 'text-blue-600',   border: 'border-blue-100' },
    green:  { bg: 'bg-green-50',  icon: 'bg-green-600',  text: 'text-green-600',  border: 'border-green-100' },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-600', text: 'text-purple-600', border: 'border-purple-100' },
    orange: { bg: 'bg-orange-50', icon: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-100' },
    red:    { bg: 'bg-red-50',    icon: 'bg-red-600',    text: 'text-red-600',    border: 'border-red-100' },
    teal:   { bg: 'bg-teal-50',   icon: 'bg-teal-600',   text: 'text-teal-600',   border: 'border-teal-100' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className={`bg-white rounded-2xl border ${c.border} p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`${c.icon} rounded-xl p-3 flex-shrink-0`}>
        <Icon className="text-white w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{title}</p>
        <p className={`text-2xl font-bold ${c.text} mt-0.5`}>{value ?? '—'}</p>
        {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// Section heading
export function SectionHeading({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// Loading skeleton
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />;
}
