import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Landmark, TrendingUp, TrendingDown, Wallet, Clock, Lock, Unlock,
  RefreshCw, Check, X, Plus, Pencil, Trash2, Repeat, Tag, AlertCircle, FileDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import {
  getAccountsSummary, getLedger, getClosedMonths, closeMonth, reopenMonth,
  getCategories, createCategory, updateCategory, deleteCategory,
  getRecurring, createRecurring, updateRecurring, deleteRecurring, generateRecurring,
  getPendingExpenses, setExpenseStatus, exportPnl, exportExpenseLedger,
} from '../api/accounts';
import { fmtPKR, fmtSignedPKR, fmtCompact, formatMonthKey, currentMonthKey, shiftMonthKey } from '../utils/money';
import MonthPicker from '../components/accounts/MonthPicker';
import SummaryCard from '../components/accounts/SummaryCard';
import ModalPortal from '../components/ModalPortal';
import ExpenseLedger from '../components/accounts/ExpenseLedger';
import ExportButtons from '../components/accounts/ExportButtons';

const CHART_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#f97316', '#14b8a6', '#ef4444'];

const TABS = [
  { key: 'overview', label: 'Overview', module: 'accounts' },
  { key: 'expenses', label: 'Expenses', module: 'expenses' },
  { key: 'ledger', label: 'Monthly Ledger', module: 'accounts' },
  { key: 'pending', label: 'Pending Bills', module: 'accounts' },
  { key: 'recurring', label: 'Recurring Bills', module: 'accounts' },
  { key: 'categories', label: 'Categories', module: 'accounts' },
];

export default function AccountsPage() {
  const { can } = useAuth();
  const { currentCampus, currentSession } = useAppContext();

  // An account granted only `expenses` reaches this screen for the register
  // alone, so the tab strip is filtered and the landing tab follows it rather
  // than defaulting to one that would show nothing.
  const visibleTabs = TABS.filter(t => can(t.module, 'view'));
  const [tab, setTab] = useState(() => (can('accounts', 'view') ? 'overview' : 'expenses'));
  const [month, setMonth] = useState(currentMonthKey);
  const [summary, setSummary] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [closed, setClosed] = useState([]);
  const [pending, setPending] = useState({ expenses: [], total: 0, count: 0 });
  const [categories, setCategories] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const closedKeys = useMemo(() => closed.filter(c => c.isClosed).map(c => c.month), [closed]);
  const isClosed = closedKeys.includes(month);

  // An account granted only `expenses` may open this screen for the register, but
  // every endpoint below belongs to `accounts` and would answer 403 — so it is
  // never asked, and the ledger furniture it cannot use is not drawn.
  const canSeeAccounts = can('accounts', 'view');
  const canEdit = can('accounts', 'edit');
  const canCreate = can('accounts', 'create');
  const canDelete = can('accounts', 'delete');

  const load = useCallback(async () => {
    if (!currentCampus || !currentSession || !canSeeAccounts) { setLoading(false); return; }
    setLoading(true);
    try {
      const year = Number(month.slice(0, 4));
      const [s, l, c, p] = await Promise.all([
        getAccountsSummary({ month }),
        getLedger({ from: `${year}-01`, to: month }),
        getClosedMonths(),
        getPendingExpenses(),
      ]);
      setSummary(s.data);
      setLedger(l.data);
      setClosed(c.data);
      setPending(p.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load the accounts ledger');
    } finally {
      setLoading(false);
    }
  }, [currentCampus, currentSession, month, canSeeAccounts]);

  useEffect(() => { load(); }, [load]);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await getCategories({ includeInactive: 'true' });
      setCategories(data);
    } catch { /* the tab shows its own empty state */ }
  }, []);

  const loadRecurring = useCallback(async () => {
    try {
      const { data } = await getRecurring({ includeInactive: 'true' });
      setRecurring(data);
    } catch { /* as above */ }
  }, []);

  useEffect(() => {
    if (tab === 'categories') loadCategories();
    if (tab === 'recurring') { loadRecurring(); loadCategories(); }
  }, [tab, loadCategories, loadRecurring]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleClose = async () => {
    if (!window.confirm(
      `Close ${formatMonthKey(month)}?\n\nIts records will be locked and its closing balance carried into the next month. ` +
      `You can reopen it later if a correction is needed.`
    )) return;
    setBusy(true);
    try {
      const { data } = await closeMonth({ month });
      toast.success(data.message);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to close the month');
    } finally { setBusy(false); }
  };

  const handleReopen = async () => {
    const reason = window.prompt(`Reopen ${formatMonthKey(month)}?\n\nWhy is it being reopened? (recorded in the activity log)`);
    if (!reason) return;
    setBusy(true);
    try {
      const { data } = await reopenMonth({ month, reason });
      toast.success(data.message);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to reopen the month');
    } finally { setBusy(false); }
  };

  const handleGenerate = async () => {
    setBusy(true);
    try {
      const { data } = await generateRecurring();
      toast.success(data.message);
      load();
      if (tab === 'recurring') loadRecurring();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to raise recurring bills');
    } finally { setBusy(false); }
  };

  const decide = async (id, status) => {
    const reason = status === 'Rejected'
      ? window.prompt('Why is this bill being rejected?') : undefined;
    if (status === 'Rejected' && !reason) return;
    try {
      await setExpenseStatus(id, { status, rejectionReason: reason });
      toast.success(status === 'Approved' ? 'Bill approved and posted to the ledger' : 'Bill rejected');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update the bill');
    }
  };

  const cards = summary?.cards;
  const monthOnMonth = (ledger?.rows || []).slice(-6).map(r => ({
    month: formatMonthKey(r.month).slice(0, 3),
    Income: r.totalIncome,
    Expenses: r.totalExpense,
  }));

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold t-body tracking-tight uppercase flex items-center gap-2">
            <Landmark className="t-brand flex-shrink-0" /> Accounts &amp; Ledger
          </h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">
            Income from fee collections, expenses, and the running monthly balance
          </p>
        </div>
        {canSeeAccounts && (
        <div className="flex flex-wrap items-center gap-2.5">
          <MonthPicker value={month} onChange={setMonth} closedMonths={closedKeys} />
          <button onClick={load} className="btn btn-ghost" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {canEdit && (isClosed ? (
            <button onClick={handleReopen} className="btn btn-ghost" disabled={busy}>
              <Unlock size={14} /> Reopen Month
            </button>
          ) : (
            <button onClick={handleClose} className="btn btn-primary" disabled={busy}>
              <Lock size={14} /> Close Month
            </button>
          ))}
        </div>
        )}
      </div>

      {canSeeAccounts && isClosed && (
        <div className="note note-warn flex items-start gap-2.5">
          <Lock size={15} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>{formatMonthKey(month)} is closed.</strong> Its expenses, salaries and advances are
            locked and cannot be added to, edited or deleted. Reopen the month to make a correction.
          </span>
        </div>
      )}

      {/* Summary cards */}
      {canSeeAccounts && (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Income" value={fmtPKR(cards?.totalIncome ?? 0)} icon={TrendingUp} tone="ok"
          sub={`${cards?.receiptCount ?? 0} fee receipts this month`} loading={loading}
        />
        <SummaryCard
          title="Total Expenses" value={fmtPKR(cards?.totalExpense ?? 0)} icon={TrendingDown} tone="bad"
          sub="Approved expenses only" loading={loading}
        />
        <SummaryCard
          title={(cards?.netBalance ?? 0) < 0 ? 'Net Loss' : 'Net Profit'}
          value={fmtSignedPKR(cards?.netBalance ?? 0)} icon={Wallet}
          tone={(cards?.netBalance ?? 0) < 0 ? 'bad' : 'ok'}
          sub={`Opening ${fmtSignedPKR(cards?.openingBalance ?? 0)} → closing ${fmtSignedPKR(cards?.closingBalance ?? 0)}`}
          loading={loading}
        />
        <SummaryCard
          title="Pending Bills" value={fmtPKR(cards?.pendingBills ?? 0)} icon={Clock}
          tone={(cards?.pendingCount ?? 0) > 0 ? 'warn' : 'neutral'}
          sub={`${cards?.pendingCount ?? 0} awaiting confirmation — not yet counted`}
          loading={loading}
        />
      </div>
      )}

      {/* Tabs */}
      <div className="tab-strip gap-1 sm:gap-4 border-b border-line">
        {visibleTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2.5 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-b-2 border-brand t-brand' : 't-muted hover:t-body'
            }`}
          >
            {t.label}
            {t.key === 'pending' && pending.count > 0 && (
              <span className="ml-1.5 badge badge-warn text-[9px]">{pending.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="t-eyebrow">Download the register for {formatMonthKey(month)}</p>
            <ExportButtons onExport={exportExpenseLedger} params={{ month }} label="Expense Ledger" />
          </div>
          <ExpenseLedger month={month} isClosed={isClosed} />
        </div>
      )}
      {tab === 'overview' && (
        <OverviewTab summary={summary} monthOnMonth={monthOnMonth} loading={loading} />
      )}
      {tab === 'ledger' && <LedgerTab ledger={ledger} loading={loading} month={month} />}
      {tab === 'pending' && (
        <PendingTab pending={pending} onDecide={decide} canEdit={canEdit} onGenerate={handleGenerate} busy={busy} />
      )}
      {tab === 'recurring' && (
        <RecurringTab
          rows={recurring} categories={categories} reload={loadRecurring}
          canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
          onGenerate={handleGenerate} busy={busy}
        />
      )}
      {tab === 'categories' && (
        <CategoriesTab
          rows={categories} reload={loadCategories}
          canCreate={canCreate} canEdit={canEdit} canDelete={canDelete}
        />
      )}
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────
function OverviewTab({ summary, monthOnMonth, loading }) {
  const breakdown = summary?.categoryBreakdown || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card card-lg p-4 sm:p-6">
        <h2 className="font-bold t-body text-sm tracking-wider uppercase">Where the money went</h2>
        <p className="text-xs t-muted mt-0.5">Approved expenses this month, by category</p>
        {loading ? (
          <div className="h-64 animate-pulse bg-surface-2 rounded-2xl mt-4" />
        ) : breakdown.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 t-faint text-xs">
            <Tag size={32} className="t-muted" />
            <span>No approved expenses this month</span>
          </div>
        ) : (
          <>
            <div className="h-56 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={breakdown} dataKey="total" nameKey="category" cx="50%" cy="50%"
                    innerRadius={48} outerRadius={78} paddingAngle={2}>
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="outline-none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => fmtPKR(v)}
                    contentStyle={{
                      background: 'var(--sms-surface-solid)', border: '1px solid var(--sms-border)',
                      borderRadius: '12px', color: 'var(--sms-text)', fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-4 max-h-40 overflow-y-auto pr-1">
              {breakdown.map((c, i) => (
                <div key={c.category} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="t-muted truncate">{c.category}</span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span className="t-faint text-[10px]">{c.share}%</span>
                    <span className="font-bold t-body">{fmtPKR(c.total)}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card card-lg p-4 sm:p-6">
        <h2 className="font-bold t-body text-sm tracking-wider uppercase">Month on month</h2>
        <p className="text-xs t-muted mt-0.5">Income against expenses over the last six months</p>
        {loading ? (
          <div className="h-64 animate-pulse bg-surface-2 rounded-2xl mt-4" />
        ) : (
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthOnMonth} barSize={14} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sms-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--sms-text-muted)', fontWeight: 600 }}
                  tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--sms-text-muted)', fontWeight: 600 }}
                  tickLine={false} axisLine={false} tickFormatter={fmtCompact} width={44} />
                <Tooltip
                  formatter={(v) => fmtPKR(v)}
                  cursor={{ fill: 'var(--sms-surface-2)' }}
                  contentStyle={{
                    background: 'var(--sms-surface-solid)', border: '1px solid var(--sms-border)',
                    borderRadius: '12px', color: 'var(--sms-text)', fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }} />
                <Bar dataKey="Income" fill="var(--sms-success)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Expenses" fill="var(--sms-danger)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Monthly ledger ──────────────────────────────────────────────────────────
function LedgerTab({ ledger, loading, month }) {
  const rows = ledger?.rows || [];
  const year = month.slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="t-muted text-xs font-semibold uppercase tracking-wider">
          Profit &amp; loss for {year}, opening balance carried month to month
        </p>
        <ExportButtons
          onExport={exportPnl}
          params={{ from: `${year}-01`, to: month }}
          disabled={rows.length === 0}
          label="Profit & Loss"
        />
      </div>

    <div className="card card-lg overflow-hidden">
      {loading ? (
        <div className="p-16 text-center flex flex-col items-center">
          <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" />
          <p className="t-muted text-xs mt-3 uppercase font-bold tracking-wider">Compiling the ledger…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-16 text-center t-faint flex flex-col items-center">
          <Landmark size={40} className="t-muted mb-3" />
          <p className="t-muted font-bold uppercase tracking-wider text-sm">Nothing recorded yet</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-xs text-left rtable">
            <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-5 py-4">Month</th>
                <th className="px-5 py-4 text-right">Opening</th>
                <th className="px-5 py-4 text-right">Fee Income</th>
                <th className="px-5 py-4 text-right">Other Income</th>
                <th className="px-5 py-4 text-right">Expenses</th>
                <th className="px-5 py-4 text-right">Net</th>
                <th className="px-5 py-4 text-right">Closing</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line t-muted">
              {rows.map(r => (
                <tr key={r.month} className="hover:bg-surface-2 transition">
                  <td data-label="Month" className="px-5 py-4 font-bold t-body md:whitespace-nowrap">{r.label}</td>
                  <td data-label="Opening" className="px-5 py-4 text-right">{fmtSignedPKR(r.openingBalance)}</td>
                  <td data-label="Fee Income" className="px-5 py-4 text-right t-ok font-semibold">{fmtPKR(r.feeIncome)}</td>
                  <td data-label="Other Income" className="px-5 py-4 text-right">{fmtPKR(r.otherIncome)}</td>
                  <td data-label="Expenses" className="px-5 py-4 text-right t-bad font-semibold">{fmtPKR(r.totalExpense)}</td>
                  <td data-label="Net" className={`px-5 py-4 text-right font-bold ${r.net < 0 ? 't-bad' : 't-ok'}`}>
                    {fmtSignedPKR(r.net)}
                  </td>
                  <td data-label="Closing" className={`px-5 py-4 text-right font-black ${r.closingBalance < 0 ? 't-bad' : 't-body'}`}>
                    {fmtSignedPKR(r.closingBalance)}
                  </td>
                  <td data-label="Status" className="px-5 py-4">
                    <span className="flex flex-col items-end md:items-start gap-1">
                      {r.isClosed
                        ? <span className="badge badge-neutral"><Lock size={9} /> Closed</span>
                        : <span className="badge badge-ok">Open</span>}
                      {r.pendingCount > 0 && (
                        <span className="badge badge-warn text-[9px]">{r.pendingCount} pending</span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  );
}

// ─── Pending bills ───────────────────────────────────────────────────────────
function PendingTab({ pending, onDecide, canEdit, onGenerate, busy }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="t-muted text-xs font-semibold uppercase tracking-wider">
          {pending.count} bill{pending.count === 1 ? '' : 's'} awaiting confirmation
          {pending.count > 0 && <> · {fmtPKR(pending.total)}</>}
        </p>
        <button onClick={onGenerate} className="btn btn-ghost self-start" disabled={busy}>
          <Repeat size={14} /> Raise due bills now
        </button>
      </div>

      <div className="card card-lg overflow-hidden">
        {pending.expenses.length === 0 ? (
          <div className="p-16 text-center t-faint flex flex-col items-center">
            <Check size={40} className="t-ok mb-3" />
            <p className="t-muted font-bold uppercase tracking-wider text-sm">Nothing to confirm</p>
            <p className="text-xs t-faint mt-1">Recurring bills appear here each month for you to approve once paid.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-xs text-left rtable">
              <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4">Bill</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Month</th>
                  <th className="px-5 py-4 text-right">Amount</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line t-muted">
                {pending.expenses.map(e => (
                  <tr key={e._id} className="hover:bg-surface-2 transition">
                    <td data-label="Bill" className="px-5 py-4 font-bold t-body">
                      <div>
                        {e.title}
                        {e.recurringSource && (
                          <span className="block text-[10px] t-faint font-medium mt-0.5">
                            <Repeat size={9} className="inline" /> recurring
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Category" className="px-5 py-4">{e.categoryRef?.name || e.category}</td>
                    <td data-label="Month" className="px-5 py-4">{formatMonthKey(e.ledgerMonth)}</td>
                    <td data-label="Amount" className="px-5 py-4 text-right font-black t-body">{fmtPKR(e.amount)}</td>
                    <td data-actions="" className="px-5 py-4">
                      {canEdit ? (
                        <div className="row-actions">
                          <button onClick={() => onDecide(e._id, 'Approved')} className="btn btn-ok btn-sm">
                            <Check size={12} /> Approve
                          </button>
                          <button onClick={() => onDecide(e._id, 'Rejected')} className="btn btn-danger btn-sm">
                            <X size={12} /> Reject
                          </button>
                        </div>
                      ) : <span className="t-faint">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Recurring bills ─────────────────────────────────────────────────────────
const blankRecurring = () => ({
  title: '', categoryRef: '', amount: '', paymentMethod: 'Bank',
  paidTo: '', dayOfMonth: 1, startMonth: currentMonthKey(), endMonth: '',
});

function RecurringTab({ rows, categories, reload, canCreate, canEdit, canDelete, onGenerate, busy }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankRecurring);
  const [saving, setSaving] = useState(false);

  const expenseCats = categories.filter(c => c.type === 'Expense' && c.isActive);

  const openNew = () => { setEditing(null); setForm(blankRecurring()); setOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      title: r.title, categoryRef: r.categoryRef?._id || r.categoryRef || '', amount: r.amount,
      paymentMethod: r.paymentMethod || 'Bank', paidTo: r.paidTo || '',
      dayOfMonth: r.dayOfMonth || 1, startMonth: r.startMonth, endMonth: r.endMonth || '',
    });
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, amount: Number(form.amount), endMonth: form.endMonth || null };
      // startMonth is fixed once set — the server refuses to move it backwards.
      if (editing) delete payload.startMonth;
      if (editing) await updateRecurring(editing._id, payload);
      else await createRecurring(payload);
      toast.success(editing ? 'Recurring bill updated' : 'Recurring bill created');
      setOpen(false);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save the recurring bill');
    } finally { setSaving(false); }
  };

  const remove = async (r) => {
    if (!window.confirm(`Stop "${r.title}"?\n\nBills already raised from it are kept.`)) return;
    try {
      const { data } = await deleteRecurring(r._id);
      toast.success(data.message);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to stop the recurring bill');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="t-muted text-xs font-semibold uppercase tracking-wider">
          Bills raised automatically each month for you to confirm once paid
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={onGenerate} className="btn btn-ghost" disabled={busy}>
            <Repeat size={14} /> Raise due bills
          </button>
          {canCreate && (
            <button onClick={openNew} className="btn btn-primary">
              <Plus size={14} /> Add Recurring Bill
            </button>
          )}
        </div>
      </div>

      <div className="card card-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-16 text-center t-faint flex flex-col items-center">
            <Repeat size={40} className="t-muted mb-3" />
            <p className="t-muted font-bold uppercase tracking-wider text-sm">No recurring bills yet</p>
            <p className="text-xs t-faint mt-1">Add rent, internet or any other fixed monthly cost so it is never forgotten.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-xs text-left rtable">
              <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-4">Bill</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4 text-right">Amount</th>
                  <th className="px-5 py-4">Day</th>
                  <th className="px-5 py-4">Runs</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line t-muted">
                {rows.map(r => (
                  <tr key={r._id} className={`hover:bg-surface-2 transition ${r.isActive ? '' : 'opacity-50'}`}>
                    <td data-label="Bill" className="px-5 py-4 font-bold t-body">
                      <div>
                        {r.title}
                        {r.paidTo && <span className="block text-[10px] t-faint font-medium mt-0.5">to {r.paidTo}</span>}
                      </div>
                    </td>
                    <td data-label="Category" className="px-5 py-4">{r.categoryRef?.name || '—'}</td>
                    <td data-label="Amount" className="px-5 py-4 text-right font-bold t-body">{fmtPKR(r.amount)}</td>
                    <td data-label="Day" className="px-5 py-4">{r.dayOfMonth}</td>
                    <td data-label="Runs" className="px-5 py-4 md:whitespace-nowrap">
                      {formatMonthKey(r.startMonth)}{r.endMonth ? ` – ${formatMonthKey(r.endMonth)}` : ' onwards'}
                    </td>
                    <td data-label="Status" className="px-5 py-4">
                      <span className={`badge ${r.isActive ? 'badge-ok' : 'badge-neutral'}`}>
                        {r.isActive ? 'Active' : 'Stopped'}
                      </span>
                    </td>
                    <td data-actions="" className="px-5 py-4">
                      <div className="row-actions">
                        {canEdit && (
                          <button onClick={() => openEdit(r)} className="icon-btn" title="Edit"><Pencil size={14} /></button>
                        )}
                        {canDelete && r.isActive && (
                          <button onClick={() => remove(r)} className="icon-btn icon-btn-danger" title="Stop"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <ModalPortal>
          <div className="modal-shell">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <div className="card card-lg modal-box sm:max-w-lg">
              <div className="px-5 sm:px-6 py-4 border-b border-line bg-surface-2 flex items-center justify-between gap-3 flex-shrink-0">
                <h2 className="text-sm font-bold uppercase tracking-wider t-body truncate">
                  {editing ? 'Edit Recurring Bill' : 'New Recurring Bill'}
                </h2>
                <button onClick={() => setOpen(false)} className="icon-btn flex-shrink-0" aria-label="Close"><X size={18} /></button>
              </div>

              <form onSubmit={submit} className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
                <div>
                  <label className="label">Title</label>
                  <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    className="field" placeholder="e.g. Building rent" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Category</label>
                    <select required value={form.categoryRef} onChange={e => setForm({ ...form, categoryRef: e.target.value })} className="field">
                      <option value="">Select a category</option>
                      {expenseCats.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Amount (Rs.)</label>
                    <input required type="number" min="0" step="0.01" value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })} className="field" placeholder="50000" />
                  </div>
                  <div>
                    <label className="label">Payment method</label>
                    <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="field">
                      {['Cash', 'Bank', 'Cheque', 'Online'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Paid to</label>
                    <input value={form.paidTo} onChange={e => setForm({ ...form, paidTo: e.target.value })}
                      className="field" placeholder="Vendor or landlord" />
                  </div>
                  <div>
                    <label className="label">Day of month</label>
                    <input type="number" min="1" max="28" value={form.dayOfMonth}
                      onChange={e => setForm({ ...form, dayOfMonth: Number(e.target.value) })} className="field" />
                    <p className="t-faint text-[10px] mt-1">28 at most, so every month has the day.</p>
                  </div>
                  <div>
                    <label className="label">Ends (optional)</label>
                    <input type="month" value={form.endMonth}
                      onChange={e => setForm({ ...form, endMonth: e.target.value })} className="field" />
                  </div>
                  {!editing && (
                    <div>
                      <label className="label">Starts</label>
                      <input type="month" required value={form.startMonth}
                        onChange={e => setForm({ ...form, startMonth: e.target.value })} className="field" />
                    </div>
                  )}
                </div>

                <div className="note note-info">
                  Each month this raises a bill marked <strong>Pending</strong>. It only counts against your
                  balance once you confirm it under Pending Bills — so a bill that has not been paid is
                  never treated as money that has left.
                </div>

                <div className="modal-actions pt-4 border-t border-line">
                  <button type="button" onClick={() => setOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted border border-line rounded-xl">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-50">
                    {editing ? 'Save Changes' : 'Create Bill'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

// ─── Categories ──────────────────────────────────────────────────────────────
function CategoriesTab({ rows, reload, canCreate, canEdit, canDelete }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCategory({ name: name.trim(), type: 'Expense' });
      toast.success('Category added');
      setName('');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add the category');
    } finally { setSaving(false); }
  };

  const toggle = async (c) => {
    try {
      await updateCategory(c._id, { isActive: !c.isActive });
      toast.success(c.isActive ? `"${c.name}" turned off` : `"${c.name}" turned on`);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update the category');
    }
  };

  const rename = async (c) => {
    const next = window.prompt('Rename category', c.name);
    if (!next || next.trim() === c.name) return;
    try {
      await updateCategory(c._id, { name: next.trim() });
      toast.success('Category renamed');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to rename the category');
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try {
      await deleteCategory(c._id);
      toast.success('Category deleted');
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete the category');
    }
  };

  const expense = rows.filter(c => c.type === 'Expense');
  const income = rows.filter(c => c.type === 'Income');

  return (
    <div className="space-y-4">
      {canCreate && (
        <form onSubmit={add} className="card card-lg p-4 flex flex-col sm:flex-row gap-3">
          <input value={name} onChange={e => setName(e.target.value)} className="field flex-1"
            placeholder="New expense category, e.g. Security Services" />
          <button type="submit" disabled={saving || !name.trim()} className="btn btn-primary disabled:opacity-50">
            <Plus size={14} /> Add Category
          </button>
        </form>
      )}

      <div className="note note-info flex items-start gap-2.5">
        <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
        <span>
          Turning a category <strong>off</strong> hides it from new entries but keeps every past expense
          that used it in your reports. Deleting is only possible for a category nothing has ever used.
        </span>
      </div>

      {[{ label: 'Expense categories', list: expense }, { label: 'Income categories', list: income }].map(group => (
        group.list.length > 0 && (
          <div key={group.label} className="card card-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-line bg-surface-2">
              <h3 className="t-eyebrow">{group.label}</h3>
            </div>
            <div className="table-scroll">
              <table className="w-full text-xs text-left rtable">
                <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-4">Name</th>
                    <th className="px-5 py-4">Suggested sub-categories</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line t-muted">
                  {group.list.map(c => (
                    <tr key={c._id} className={`hover:bg-surface-2 transition ${c.isActive ? '' : 'opacity-60'}`}>
                      <td data-label="Name" className="px-5 py-4 font-bold t-body">
                        <div>
                          {c.name}
                          {c.isDefault && <span className="ml-2 badge badge-neutral text-[9px]">default</span>}
                          {c.isSystem && <span className="ml-1.5 badge badge-brand text-[9px]">auto</span>}
                        </div>
                      </td>
                      <td data-label="Sub-categories" className="px-5 py-4 t-faint">
                        {c.suggested?.length ? c.suggested.join(', ') : '—'}
                      </td>
                      <td data-label="Status" className="px-5 py-4">
                        <span className={`badge ${c.isActive ? 'badge-ok' : 'badge-neutral'}`}>
                          {c.isActive ? 'Active' : 'Off'}
                        </span>
                      </td>
                      <td data-actions="" className="px-5 py-4">
                        <div className="row-actions">
                          {canEdit && (
                            <>
                              <button onClick={() => rename(c)} className="icon-btn" title="Rename"><Pencil size={14} /></button>
                              <button onClick={() => toggle(c)} className="btn btn-ghost btn-sm">
                                {c.isActive ? 'Turn off' : 'Turn on'}
                              </button>
                            </>
                          )}
                          {canDelete && !c.isSystem && (
                            <button onClick={() => remove(c)} className="icon-btn icon-btn-danger" title="Delete"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ))}
    </div>
  );
}
