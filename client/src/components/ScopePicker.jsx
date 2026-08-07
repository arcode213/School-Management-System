import { Check, Globe } from 'lucide-react';

/**
 * Which campuses (or sessions) an account is confined to.
 *
 * Nothing ticked means unrestricted — that is what every account created before
 * this feature has, and re-stating it as "All" rather than "none" is the honest
 * reading: an empty restriction list restricts nothing. Ticking even one entry
 * turns it into a whitelist, and the server then refuses anything outside it.
 */
export default function ScopePicker({ label, icon: Icon, options, selected, onChange, allLabel, hint }) {
  const isAll = selected.length === 0;

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="block text-[10px] font-bold t-muted uppercase tracking-widest">{label}</label>
        {!isAll && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] font-bold t-faint hover:t-brand uppercase tracking-wider transition"
          >
            Clear (allow all)
          </button>
        )}
      </div>

      <div className="border border-line rounded-2xl bg-surface-2 p-2 max-h-40 overflow-y-auto space-y-0.5">
        {/* The unrestricted state gets its own row so it is a thing you pick,
            not a state you reach by unticking everything and hoping. */}
        <button
          type="button"
          onClick={() => onChange([])}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition ${
            isAll ? 'bg-brand-soft border border-brand-border' : 'border border-transparent hover:bg-surface-3'
          }`}
        >
          <span className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center flex-shrink-0 ${
            isAll ? 'bg-brand-soft border-brand-border t-brand' : 'bg-surface border-line'
          }`}>
            {isAll && <Check size={12} strokeWidth={3} />}
          </span>
          <Globe size={13} className={isAll ? 't-brand' : 't-faint'} />
          <span className={`text-xs font-bold ${isAll ? 't-brand' : 't-muted'}`}>{allLabel}</span>
        </button>

        {options.map(opt => {
          const checked = selected.includes(opt._id);
          return (
            <button
              key={opt._id}
              type="button"
              onClick={() => toggle(opt._id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition ${
                checked ? 'bg-brand-soft border border-brand-border' : 'border border-transparent hover:bg-surface-3'
              }`}
            >
              <span className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center flex-shrink-0 ${
                checked ? 'bg-brand-soft border-brand-border t-brand' : 'bg-surface border-line'
              }`}>
                {checked && <Check size={12} strokeWidth={3} />}
              </span>
              {Icon && <Icon size={13} className={checked ? 't-brand' : 't-faint'} />}
              <span className={`text-xs font-semibold truncate ${checked ? 't-brand' : 't-body'}`}>
                {opt.name}
                {opt.isActive && <span className="t-faint font-medium"> •</span>}
              </span>
            </button>
          );
        })}

        {options.length === 0 && (
          <p className="t-faint text-[11px] font-medium px-2.5 py-3 text-center">Nothing to choose from yet.</p>
        )}
      </div>

      {hint && <p className="t-faint text-[10px] mt-1.5 font-medium leading-relaxed">{hint}</p>}
    </div>
  );
}
