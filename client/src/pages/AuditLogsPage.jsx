import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  ScrollText, Search, ChevronLeft, ChevronRight, ChevronDown, Activity,
  ShieldAlert, Clock, RotateCw, ArrowRight, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getLogs, getLogMeta } from '../api/logs';

// Colour follows consequence, not novelty: destructive actions read red, refused
// ones amber, so a page of routine edits does not compete with them for attention.
const ACTION_STYLE = {
  create: 'bg-ok-soft t-ok border-ok-border',
  'bulk-create': 'bg-ok-soft t-ok border-ok-border',
  update: 'bg-brand-soft t-brand border-brand-border',
  'bulk-update': 'bg-brand-soft t-brand border-brand-border',
  delete: 'bg-bad-soft t-bad border-bad-border',
  'reset-data': 'bg-bad-soft t-bad border-bad-border',
  login: 'bg-surface-3 t-muted border-line',
  'login-failed': 'bg-warn-soft t-warn border-warn-border',
  denied: 'bg-warn-soft t-warn border-warn-border',
  other: 'bg-surface-3 t-muted border-line',
};

const ACTION_LABEL = {
  create: 'Created', update: 'Updated', delete: 'Deleted',
  'bulk-create': 'Bulk import', 'bulk-update': 'Bulk update',
  login: 'Signed in', 'login-failed': 'Sign-in failed',
  denied: 'Blocked', 'reset-data': 'Data reset', other: 'Other',
};

const fmtWhen = (iso) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
};

// Values land here straight from the record, so they can be anything at all.
const fmtValue = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString();
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  // ISO timestamps are unreadable in a table cell; dates are what people mean.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s).toLocaleString('en-GB');
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ users: [], modules: [], actions: [], stats: {} });
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getLogs({
        page, limit: 50,
        search: search || undefined,
        user: filterUser || undefined,
        module: filterModule || undefined,
        action: filterAction || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterUser, filterModule, filterAction, from, to]);

  useEffect(() => {
    // Typing in the search box should not fire a query per keystroke.
    const t = setTimeout(fetchLogs, 300);
    return () => clearTimeout(t);
  }, [fetchLogs]);

  useEffect(() => {
    getLogMeta().then(({ data }) => setMeta(data)).catch(() => {});
  }, []);

  const resetFilters = () => {
    setSearch(''); setFilterUser(''); setFilterModule(''); setFilterAction('');
    setFrom(''); setTo(''); setPage(1);
  };

  const exportCsv = () => {
    const rows = [
      ['Date', 'Time', 'User', 'Role', 'Action', 'Area', 'Record', 'Details', 'Changes', 'IP'],
      ...logs.map(l => {
        const w = fmtWhen(l.createdAt);
        return [
          w.date, w.time, l.userName, l.userRole,
          ACTION_LABEL[l.action] || l.action, l.module, l.entityLabel, l.description,
          (l.changes || []).map(c => `${c.label}: ${fmtValue(c.from)} -> ${fmtValue(c.to)}`).join('; '),
          l.ip,
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-log-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const anyFilter = search || filterUser || filterModule || filterAction || from || to;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold t-body tracking-tight uppercase flex items-center gap-2">
            <ScrollText className="t-brand" size={22} /> Activity Logs
          </h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">
            Every action taken in the system — who did it, what changed, and when
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={exportCsv} disabled={logs.length === 0} className="btn btn-ghost disabled:opacity-40">
            <Download size={14} /> Export Page
          </button>
          <button onClick={fetchLogs} className="btn btn-primary">
            <RotateCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Activity className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Total Recorded</p>
            <p className="text-2xl font-extrabold t-brand mt-0.5 tracking-tight">
              {(meta.stats?.total ?? 0).toLocaleString()} entries
            </p>
            <p className="t-faint text-xs mt-1 font-medium">Since logging was switched on</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Clock className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Last 24 Hours</p>
            <p className="text-2xl font-extrabold t-ok mt-0.5 tracking-tight">
              {(meta.stats?.today ?? 0).toLocaleString()} actions
            </p>
            <p className="t-faint text-xs mt-1 font-medium">Across all users and campuses</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-amber-600/80 to-amber-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <ShieldAlert className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Blocked / Failed</p>
            <p className={`text-2xl font-extrabold mt-0.5 tracking-tight ${meta.stats?.failures ? 't-warn' : 't-muted'}`}>
              {(meta.stats?.failures ?? 0).toLocaleString()} in 24h
            </p>
            <p className="t-faint text-xs mt-1 font-medium">Refused actions and failed sign-ins</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-lg p-4 flex flex-wrap gap-3 items-center">
        <div className="flex bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs flex-1 min-w-56 items-center gap-2">
          <Search size={14} className="t-faint" />
          <input
            type="text"
            placeholder="Search by user, record, or what was done..."
            className="bg-transparent outline-none w-full t-body placeholder-faint font-medium"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(1); }}
          className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer">
          <option value="">All Users</option>
          {meta.users?.map(u => (
            <option key={u._id} value={u._id} className="bg-surface-2">{u.name} ({u.count})</option>
          ))}
        </select>

        <select value={filterModule} onChange={e => { setFilterModule(e.target.value); setPage(1); }}
          className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer">
          <option value="">All Areas</option>
          {meta.modules?.map(m => (
            <option key={m.key} value={m.key} className="bg-surface-2">{m.label}</option>
          ))}
        </select>

        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}
          className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer">
          <option value="">All Actions</option>
          {meta.actions?.map(a => (
            <option key={a.key} value={a.key} className="bg-surface-2">{a.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
            className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer" />
          <ArrowRight size={12} className="t-faint" />
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
            className="bg-surface-2 border border-line rounded-xl px-3 py-2 text-xs font-semibold t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer" />
        </div>

        {anyFilter && (
          <button onClick={resetFilters}
            className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider t-muted hover:t-brand border border-line rounded-xl transition">
            Clear
          </button>
        )}
      </div>

      {/* Log table */}
      <div className="card card-lg overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 t-muted">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            <p className="text-xs uppercase font-bold tracking-wider mt-3">Loading activity...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4">When</th>
                  <th className="px-5 py-4">Who</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Area</th>
                  <th className="px-5 py-4">What Happened</th>
                  <th className="px-5 py-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line t-muted">
                {logs.map(log => {
                  const when = fmtWhen(log.createdAt);
                  const open = expanded === log._id;
                  const detailed = (log.changes?.length > 0) || log.snapshot;

                  return (
                    <Fragment key={log._id}>
                      <tr
                        className={`hover:bg-surface-2 transition ${detailed ? 'cursor-pointer' : ''} ${!log.success ? 'bg-warn-soft/30' : ''}`}
                        onClick={() => detailed && setExpanded(open ? null : log._id)}
                      >
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <p className="font-bold t-body">{when.date}</p>
                          <p className="t-faint text-[10px] font-mono mt-0.5">{when.time}</p>
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <p className="font-bold t-body">{log.userName}</p>
                          <p className="t-faint text-[10px] font-medium mt-0.5">
                            {log.userRole || '—'}{log.userEmail ? ` · ${log.userEmail}` : ''}
                          </p>
                        </td>

                        <td className="px-5 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${ACTION_STYLE[log.action] || ACTION_STYLE.other}`}>
                            {ACTION_LABEL[log.action] || log.action}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 t-muted font-medium capitalize">
                          {log.module}
                          {log.campus?.name && (
                            <span className="block t-faint text-[10px] mt-0.5">{log.campus.name}</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 t-body font-medium max-w-md">
                          {log.description}
                          {log.entityLabel && (
                            <span className="block t-faint text-[10px] font-medium mt-0.5">{log.entityLabel}</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          {detailed && (
                            <ChevronDown size={14} className={`t-faint transition-transform ${open ? 'rotate-180' : ''}`} />
                          )}
                        </td>
                      </tr>

                      {/* The field-by-field record of what moved. */}
                      {open && (
                        <tr className="bg-surface-2">
                          <td colSpan="6" className="px-5 py-4">
                            {log.changes?.length > 0 ? (
                              <div className="border border-line rounded-xl overflow-hidden">
                                <table className="w-full text-[11px]">
                                  <thead className="bg-surface-3 t-muted uppercase text-[9px] font-bold tracking-wider">
                                    <tr>
                                      <th className="px-4 py-2 text-left w-1/4">Field</th>
                                      <th className="px-4 py-2 text-left">Was</th>
                                      <th className="px-4 py-2 text-left">Changed To</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-line">
                                    {log.changes.map((c, i) => (
                                      <tr key={i}>
                                        <td className="px-4 py-2 font-bold t-body">{c.label || c.field}</td>
                                        <td className="px-4 py-2 t-bad font-mono">{fmtValue(c.from)}</td>
                                        <td className="px-4 py-2 t-ok font-mono">{fmtValue(c.to)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : log.snapshot ? (
                              <div>
                                <p className="t-muted text-[10px] font-bold uppercase tracking-widest mb-2">
                                  {log.action === 'delete' ? 'Record as it stood when deleted' : 'Record as created'}
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5 border border-line rounded-xl p-4 bg-surface">
                                  {Object.entries(log.snapshot)
                                    .filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
                                    .map(([k, v]) => (
                                      <div key={k} className="min-w-0">
                                        <p className="t-faint text-[9px] font-bold uppercase tracking-wider">{k}</p>
                                        <p className="t-body font-medium truncate">{fmtValue(v)}</p>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ) : null}

                            <p className="t-faint text-[10px] font-mono mt-3">
                              {log.method} {log.path} · HTTP {log.statusCode}
                              {log.ip ? ` · from ${log.ip}` : ''}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {logs.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-12 text-center t-faint font-medium">
                      {anyFilter
                        ? 'No activity matches these filters.'
                        : 'No activity recorded yet. Actions will appear here as they happen.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-between items-center p-4 border-t border-line bg-surface-2">
            <p className="text-xs t-muted font-medium">
              Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} entries
            </p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 t-muted hover:t-body disabled:opacity-20 disabled:cursor-not-allowed border border-line rounded-xl transition bg-surface">
                <ChevronLeft size={14} />
              </button>
              <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 t-muted hover:t-body disabled:opacity-20 disabled:cursor-not-allowed border border-line rounded-xl transition bg-surface">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
