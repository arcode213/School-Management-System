import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { formatMonthKey, shiftMonthKey, currentMonthKey } from '../../utils/money';

/**
 * Stepping through ledger months.
 *
 * Arrows rather than a bare dropdown because the ledger is nearly always read one
 * month either side of where you are. A closed month is marked as it is stepped
 * onto, so the reason a screen has gone read-only is visible rather than only
 * discovered when a save is refused.
 *
 * Forward is capped at the current month: there is nothing to see in a month that
 * has not happened.
 */
export default function MonthPicker({ value, onChange, closedMonths = [], className = '' }) {
  const now = currentMonthKey();
  const isClosed = closedMonths.includes(value);
  const atLatest = value >= now;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(shiftMonthKey(value, -1))}
        className="icon-btn"
        aria-label="Previous month"
        title="Previous month"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="surface-muted rounded-xl px-3 py-2 min-w-[9.5rem] text-center">
        <span className="text-xs font-bold uppercase tracking-wider t-body">
          {formatMonthKey(value)}
        </span>
        {isClosed && (
          <span className="flex items-center justify-center gap-1 t-warn text-[9px] font-bold uppercase tracking-wider mt-0.5">
            <Lock size={9} /> Closed
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(shiftMonthKey(value, 1))}
        disabled={atLatest}
        className="icon-btn disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Next month"
        title={atLatest ? 'This is the current month' : 'Next month'}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
