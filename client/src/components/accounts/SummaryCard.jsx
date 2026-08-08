import { fmtSignedPKR } from '../../utils/money';

/**
 * One figure on the accounts dashboard.
 *
 * `tone` follows what the number MEANS, not whether it is large: a net balance is
 * green when positive and red when negative, so a loss reads as a loss at a
 * glance rather than needing the minus sign to be spotted.
 */
const TONES = {
  neutral: { text: 't-body', icon: 'bg-surface-3 t-muted border-line' },
  brand:   { text: 't-brand', icon: 'bg-brand-soft t-brand border-brand-border' },
  ok:      { text: 't-ok', icon: 'bg-ok-soft t-ok border-ok-border' },
  bad:     { text: 't-bad', icon: 'bg-bad-soft t-bad border-bad-border' },
  warn:    { text: 't-warn', icon: 'bg-warn-soft t-warn border-warn-border' },
};

export default function SummaryCard({
  title, value, sub, icon: Icon, tone = 'neutral', signed = false, loading = false,
}) {
  const t = TONES[tone] || TONES.neutral;

  return (
    <div className="card card-lg card-hover p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
      {Icon && (
        <div className={`rounded-xl border p-3 flex-shrink-0 ${t.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="t-eyebrow">{title}</p>
        {loading ? (
          <div className="animate-pulse bg-surface-3 rounded-lg h-7 w-28 mt-1.5" />
        ) : (
          <p className={`text-xl sm:text-2xl font-extrabold mt-0.5 tracking-tight break-words ${t.text}`}>
            {typeof value === 'number'
              ? (signed ? fmtSignedPKR(value) : value.toLocaleString())
              : value}
          </p>
        )}
        {sub && <p className="t-faint text-xs mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  );
}
