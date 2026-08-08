import { Fragment, useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import {
  MODULES, MODULE_GROUPS, ACTION_LABELS, ACTION_HINTS, ACTIONS, PRESETS, countGrid,
} from '../utils/permissions';

/**
 * The access grid the admin ticks: one row per screen, one box per action.
 *
 * `view` is read and the other three are write, which is why a write box also
 * turns `view` on — an account allowed to edit records it cannot open would be
 * given a screen it is blocked from loading. The server applies the same rule on
 * save, so this is the interface agreeing with the rule rather than inventing it.
 */
function Box({ checked, onChange, disabled, title }) {
  if (disabled) {
    return (
      <div className="flex justify-center" title="Not applicable to this screen">
        <Minus size={12} className="t-faint opacity-40" />
      </div>
    );
  }
  return (
    <div className="flex justify-center">
      <label className="relative inline-flex cursor-pointer" title={title}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          className={`w-[18px] h-[18px] rounded-md border flex items-center justify-center transition
            ${checked
              ? 'bg-brand-soft border-brand-border t-brand'
              : 'bg-surface-2 border-line t-faint hover:border-brand-border'}`}
        >
          {checked && <Check size={12} strokeWidth={3} />}
        </span>
      </label>
    </div>
  );
}

export default function PermissionMatrix({ grid, onChange, disabled = false }) {
  const { on, total } = useMemo(() => countGrid(grid), [grid]);

  // Writing a box always produces a fresh grid — the form holds this in state and
  // React needs a new reference to notice.
  const setBox = (moduleKey, action, value) => {
    const module = MODULES.find(m => m.key === moduleKey);
    const row = { ...(grid[moduleKey] || {}), [action]: value };

    // A write implies a read; clearing the read clears the writes with it, so the
    // grid can never say "may edit, may not open".
    if (value && action !== 'view' && module.actions.includes('view')) row.view = true;
    if (!value && action === 'view') for (const a of module.actions) row[a] = false;

    onChange({ ...grid, [moduleKey]: row });
  };

  const setRow = (moduleKey, value) => {
    const module = MODULES.find(m => m.key === moduleKey);
    const row = {};
    for (const a of module.actions) row[a] = value;
    onChange({ ...grid, [moduleKey]: row });
  };

  const setColumn = (action, value) => {
    const next = { ...grid };
    for (const m of MODULES) {
      if (!m.actions.includes(action)) continue;
      const row = { ...(next[m.key] || {}), [action]: value };
      if (value && action !== 'view' && m.actions.includes('view')) row.view = true;
      if (!value && action === 'view') for (const a of m.actions) row[a] = false;
      next[m.key] = row;
    }
    onChange(next);
  };

  const rowState = (module) => {
    const granted = module.actions.filter(a => grid?.[module.key]?.[a]).length;
    return { all: granted === module.actions.length, some: granted > 0 };
  };

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      {/* Presets */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[10px] font-bold t-faint uppercase tracking-widest mr-1">Start from</span>
        {PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            title={p.hint}
            onClick={() => onChange(p.build())}
            className="px-2.5 py-1 rounded-lg border border-line bg-surface-2 t-muted hover:t-brand hover:border-brand-border text-[10px] font-bold uppercase tracking-wider transition"
          >
            {p.label}
          </button>
        ))}
        <span className="sm:ml-auto text-[10px] font-bold t-faint uppercase tracking-wider">
          {on} / {total} granted
        </span>
      </div>

      {/* A tick-box grid does not survive being stacked into cards — the whole
          point is reading a row against its columns — so on a narrow screen it
          scrolls sideways inside its own frame instead. */}
      <div className="border border-line rounded-2xl overflow-hidden table-scroll">
        <table className="w-full text-xs min-w-[34rem]">
          <thead className="bg-surface-2 border-b border-line">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-bold t-muted uppercase tracking-wider">
                Screen / Data
              </th>
              {ACTIONS.map(a => (
                <th key={a} className="px-2 py-3 w-20">
                  {/* The column header doubles as a "tick this action everywhere"
                      control — faster than twelve individual boxes. */}
                  <button
                    type="button"
                    onClick={() => setColumn(a, !MODULES.every(m => !m.actions.includes(a) || grid?.[m.key]?.[a]))}
                    title={`${ACTION_HINTS[a]} — click to toggle this column`}
                    className="w-full text-[10px] font-bold t-muted hover:t-brand uppercase tracking-wider transition"
                  >
                    {ACTION_LABELS[a]}
                  </button>
                </th>
              ))}
              <th className="px-3 py-3 w-16 text-[10px] font-bold t-muted uppercase tracking-wider">All</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {MODULE_GROUPS.map(group => (
              <Fragment key={group}>
                <tr className="bg-surface-2/60">
                  <td colSpan={ACTIONS.length + 2} className="px-4 py-1.5 text-[9px] font-bold t-faint uppercase tracking-[0.12em]">
                    {group}
                  </td>
                </tr>

                {MODULES.filter(m => m.group === group).map(module => {
                  const state = rowState(module);
                  return (
                    <tr key={module.key} className="hover:bg-surface-2 transition">
                      <td className="px-4 py-2.5">
                        <p className="font-bold t-body">{module.label}</p>
                        <p className="t-faint text-[10px] font-medium mt-0.5 leading-snug">{module.hint}</p>
                      </td>

                      {ACTIONS.map(a => (
                        <td key={a} className="px-2 py-2.5">
                          <Box
                            checked={!!grid?.[module.key]?.[a]}
                            disabled={!module.actions.includes(a)}
                            title={`${module.label} — ${ACTION_HINTS[a]}`}
                            onChange={(v) => setBox(module.key, a, v)}
                          />
                        </td>
                      ))}

                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setRow(module.key, !state.all)}
                          className={`text-[9px] font-bold uppercase tracking-wider transition ${
                            state.all ? 't-brand' : 't-faint hover:t-brand'
                          }`}
                        >
                          {state.all ? 'None' : 'All'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
