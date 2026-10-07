import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Wallet, HandCoins, Printer, Plus, X, Check, Trash2, RefreshCw, Lock, AlertCircle,
  Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { getEmployees } from '../api/employees';
import {
  getSalarySheet, paySalary, updateSalaryRecord, getAdvances, createAdvance, cancelAdvance, getClosedMonths,
  exportSalarySheet,
} from '../api/accounts';
import { fmtPKR, formatMonthKey, currentMonthKey, shiftMonthKey } from '../utils/money';
import MonthPicker from '../components/accounts/MonthPicker';
import SummaryCard from '../components/accounts/SummaryCard';
import ModalPortal from '../components/ModalPortal';
import SalarySlip from '../components/accounts/SalarySlip';
import ExportButtons from '../components/accounts/ExportButtons';

export default function SalarySheetPage() {
  const { can } = useAuth();
  const { currentCampus, currentSession } = useAppContext();

  const [tab, setTab] = useState('sheet');
  const [month, setMonth] = useState(currentMonthKey);
  const [sheet, setSheet] = useState(null);
  const [advances, setAdvances] = useState({ advances: [], totals: { outstanding: 0, count: 0 } });
  const [closedKeys, setClosedKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  const [payRow, setPayRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [slipRow, setSlipRow] = useState(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);

  const isClosed = closedKeys.includes(month);
  const canPay = can('salaries', 'create');
  const canEdit = can('salaries', 'edit') || can('salaries', 'create');
  const canManageAdvances = can('accounts', 'create');

  const load = useCallback(async () => {
    if (!currentCampus || !currentSession) return;
    setLoading(true);
    try {
      const [s, a, c] = await Promise.all([
        getSalarySheet({ month }),
        getAdvances(),
        getClosedMonths(),
      ]);
      setSheet(s.data);
      setAdvances(a.data);
      setClosedKeys(c.data.filter(x => x.isClosed).map(x => x.month));
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load the salary sheet');
    } finally {
      setLoading(false);
    }
  }, [currentCampus, currentSession, month]);

  useEffect(() => { load(); }, [load]);

  const totals = sheet?.totals;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold t-body tracking-tight uppercase flex items-center gap-2">
            <Wallet className="t-brand flex-shrink-0" /> Salary Sheet
          </h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">
            Monthly pay for every active staff member, with advances deducted automatically
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <MonthPicker value={month} onChange={setMonth} closedMonths={closedKeys} />
          <button onClick={load} className="btn btn-ghost" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <ExportButtons
            onExport={exportSalarySheet}
            params={{ month }}
            disabled={!sheet?.rows?.length}
            label="Salary Sheet"
          />
          {canManageAdvances && !isClosed && (
            <button onClick={() => setAdvanceOpen(true)} className="btn btn-primary">
              <HandCoins size={14} /> Give Advance
            </button>
          )}
        </div>
      </div>

      {isClosed && (
        <div className="note note-warn flex items-start gap-2.5">
          <Lock size={15} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>{formatMonthKey(month)} is closed.</strong> Salaries for this month can no longer be
            paid or changed. Reopen the month from Accounts &amp; Ledger if a correction is needed.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard title="Staff on sheet" value={totals?.headcount ?? 0} icon={Users} tone="brand"
          sub="Active employees at this campus" loading={loading} />
        <SummaryCard title="Net payable" value={fmtPKR(totals?.net ?? 0)} icon={Wallet} tone="neutral"
          sub={`Gross ${fmtPKR(totals?.gross ?? 0)} − deductions ${fmtPKR(totals?.deductions ?? 0)}`} loading={loading} />
        <SummaryCard title="Paid" value={fmtPKR(totals?.paid ?? 0)} icon={Check} tone="ok"
          sub={`${formatMonthKey(month)}`} loading={loading} />
        <SummaryCard title="Still owed" value={fmtPKR(totals?.outstanding ?? 0)} icon={AlertCircle}
          tone={(totals?.outstanding ?? 0) > 0 ? 'warn' : 'neutral'} sub="Unpaid on this sheet" loading={loading} />
      </div>

      <div className="tab-strip gap-1 sm:gap-4 border-b border-line">
        {[{ key: 'sheet', label: 'Salary Sheet' }, { key: 'advances', label: 'Advances' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`pb-2.5 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
              tab === t.key ? 'border-b-2 border-brand t-brand' : 't-muted hover:t-body'
            }`}>
            {t.label}
            {t.key === 'advances' && advances.totals.count > 0 && (
              <span className="ml-1.5 badge badge-warn text-[9px]">{advances.totals.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'sheet' ? (
        <SheetTable
          sheet={sheet} loading={loading} isClosed={isClosed} canPay={canPay} canEdit={canEdit}
          onPay={setPayRow} onEdit={setEditRow} onSlip={setSlipRow}
        />
      ) : (
        <AdvancesTable
          data={advances} reload={load} canManage={canManageAdvances}
        />
      )}

      {payRow && (
        <PayModal
          row={payRow} month={month}
          onClose={() => setPayRow(null)}
          onSaved={() => { setPayRow(null); load(); }}
        />
      )}

      {editRow && (
        <EditSalaryModal
          row={editRow} month={month}
          onClose={() => setEditRow(null)}
          onSaved={() => { setEditRow(null); load(); }}
        />
      )}

      {advanceOpen && (
        <AdvanceModal
          month={month}
          onClose={() => setAdvanceOpen(false)}
          onSaved={() => { setAdvanceOpen(false); load(); }}
        />
      )}

      {slipRow && <SalarySlip row={slipRow} month={month} onClose={() => setSlipRow(null)} />}
    </div>
  );
}

const getDaysInMonth = () => 30;
const getWorkingDaysInMonth = () => 30;

// ─── Sheet ───────────────────────────────────────────────────────────────────
function SheetTable({ sheet, loading, isClosed, canPay, canEdit, onPay, onEdit, onSlip }) {
  const { can } = useAuth();
  const rows = sheet?.rows || [];

  if (loading) {
    return (
      <div className="card card-lg p-16 text-center flex flex-col items-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand border-t-transparent rounded-full" />
        <p className="t-muted text-xs mt-3 uppercase font-bold tracking-wider">Building the sheet…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card card-lg p-16 text-center t-faint flex flex-col items-center">
        <Users size={40} className="t-muted mb-3" />
        <p className="t-muted font-bold uppercase tracking-wider text-sm">No active staff at this campus</p>
      </div>
    );
  }

  return (
    <div className="card card-lg overflow-hidden">
      <div className="table-scroll">
        <table className="w-full text-xs text-left rtable">
          <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
            <tr>
              <th className="px-5 py-4">Employee</th>
              <th className="px-5 py-4 text-right">Base</th>
              <th className="px-5 py-4 text-right">Allowances</th>
              <th className="px-5 py-4 text-right">Sec. Deposit</th>
              <th className="px-5 py-4 text-right">Deductions</th>
              <th className="px-5 py-4 text-right">Net Payable</th>
              <th className="px-5 py-4 text-right">Paid</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line t-muted">
            {rows.map(r => (
              <tr key={r.employee._id} className="hover:bg-surface-2 transition">
                <td data-label="Employee" className="px-5 py-4 font-bold t-body">
                  <div>
                    {can('employees', 'read') ? (
                      <Link to={`/employees/${r.employee._id}`} className="hover:underline hover:text-brand transition-colors">
                        {r.employee.fullName}
                      </Link>
                    ) : (
                      r.employee.fullName
                    )}
                    {r.employee.status && r.employee.status !== 'Active' && (
                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-warn-soft t-warn border border-warn-border">
                        {r.employee.status}
                      </span>
                    )}
                    <span className="block text-[10px] t-faint font-mono mt-0.5">
                      {r.employee.employeeId} · {r.employee.designation}
                      {r.attendanceBonus > 0 && (
                        <span className="text-ok font-semibold ml-1.5" title="Bonus">
                          (incl. bonus {fmtPKR(r.attendanceBonus)})
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td data-label="Base" className="px-5 py-4 text-right">{fmtPKR(r.baseSalary)}</td>
                <td data-label="Allowances" className="px-5 py-4 text-right t-ok">{fmtPKR(r.allowances)}</td>
                <td data-label="Sec. Deposit" className="px-5 py-4 text-right font-medium">
                  {r.securityDeposit > 0 ? (
                    <span className="text-amber-500 font-semibold">{fmtPKR(r.securityDeposit)}</span>
                  ) : (
                    <span className="t-faint">—</span>
                  )}
                </td>
                <td data-label="Deductions" className="px-5 py-4 text-right">
                  <div>
                    <span className="t-bad font-semibold">{fmtPKR(r.deductions)}</span>
                    {r.advanceDeduction > 0 && (
                      <span className="block text-[10px] t-warn mt-0.5">
                        incl. advance {fmtPKR(r.advanceDeduction)}
                      </span>
                    )}
                  </div>
                </td>
                <td data-label="Net Payable" className="px-5 py-4 text-right font-black t-body">{fmtPKR(r.netSalary)}</td>
                <td data-label="Paid" className="px-5 py-4 text-right t-ok font-semibold">{fmtPKR(r.amountPaid)}</td>
                <td data-label="Status" className="px-5 py-4">
                  <span className={`badge ${
                    r.status === 'Paid' ? 'badge-ok' : r.status === 'Partial' ? 'badge-warn' : 'badge-neutral'
                  }`}>{r.status}</span>
                </td>
                <td data-actions="" className="px-5 py-4">
                  <div className="row-actions">
                    {canPay && !isClosed && r.status !== 'Paid' && r.outstanding > 0 && (
                      <button onClick={() => onPay(r)} className="btn btn-ok btn-sm" title="Pay Remaining Salary">
                        <Wallet size={12} /> Pay
                      </button>
                    )}
                    {canEdit && !isClosed && (
                      <button onClick={() => onEdit(r)} className="icon-btn hover:text-brand" title="Edit salary record">
                        <Pencil size={14} />
                      </button>
                    )}
                    {r.posted && (
                      <button onClick={() => onSlip(r)} className="icon-btn" title="Salary slip">
                        <Printer size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pay modal ───────────────────────────────────────────────────────────────
function PayModal({ row, month, onClose, onSaved }) {
  const [form, setForm] = useState({
    baseSalary: row.baseSalary,
    allowances: row.allowances || 0,
    allowanceDays: '',
    absenceDeduction: row.absenceDeduction || 0,
    taxDeduction: row.taxDeduction || 0,
    securityDeposit: row.securityDeposit || 0,
    otherDeduction: row.otherDeduction || 0,
    absentDays: row.absentDays || 0,
    attendanceBonus: row.attendanceBonus || 0,
    amountPaid: '',
    paymentMethod: 'Bank Transfer',
    remarks: '',
  });
  const [saving, setSaving] = useState(false);

  const perDaySalary = Math.round((Number(form.baseSalary || 0) / 30) * 100) / 100;

  const handleBaseSalaryChange = (val) => {
    const base = Number(val) || 0;
    const perDay = base / 30;
    const abs = Number(form.absentDays) || 0;
    const allowDays = Number(form.allowanceDays) || 0;
    setForm(prev => ({
      ...prev,
      baseSalary: val,
      absenceDeduction: abs > 0 ? Math.round(abs * perDay) : prev.absenceDeduction,
      allowances: allowDays > 0 ? Math.round(allowDays * perDay) : prev.allowances,
    }));
  };

  const handleAbsentDaysChange = (val) => {
    const abs = val === '' ? '' : Math.max(0, Number(val));
    const perDay = Number(form.baseSalary || 0) / 30;
    const ded = abs === '' || abs === 0 ? 0 : Math.round(abs * perDay);
    setForm(prev => ({ ...prev, absentDays: val, absenceDeduction: ded }));
  };

  const handleAllowanceDaysChange = (val) => {
    const days = val === '' ? '' : Math.max(0, Number(val));
    const perDay = Number(form.baseSalary || 0) / 30;
    const allow = days === '' || days === 0 ? 0 : Math.round(days * perDay);
    setForm(prev => ({ ...prev, allowanceDays: val, allowances: allow }));
  };

  const roundUp10 = (n) => (n <= 0 ? 0 : Math.ceil(n / 10) * 10);
  const n = (v) => Number(v) || 0;
  const deductions = n(form.absenceDeduction) + n(form.taxDeduction) + n(form.securityDeposit) + n(form.otherDeduction) + n(row.advanceDeduction);
  const gross = n(form.baseSalary) + n(form.allowances) + n(form.attendanceBonus);
  const rawNet = gross - deductions;
  const net = roundUp10(rawNet);
  const paying = form.amountPaid === '' ? net : n(form.amountPaid);
  const isPartial = paying > 0 && paying < net;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await paySalary({
        employee: row.employee._id,
        month,
        baseSalary: n(form.baseSalary),
        allowances: n(form.allowances),
        allowanceDays: n(form.allowanceDays),
        absenceDeduction: n(form.absenceDeduction),
        taxDeduction: n(form.taxDeduction),
        securityDeposit: n(form.securityDeposit),
        otherDeduction: n(form.otherDeduction),
        absentDays: n(form.absentDays),
        attendanceBonus: n(form.attendanceBonus),
        ...(form.amountPaid === '' ? {} : { amountPaid: n(form.amountPaid) }),
        paymentMethod: form.paymentMethod,
        remarks: form.remarks || undefined,
      });
      toast.success(data.message);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record the salary payment');
    } finally { setSaving(false); }
  };

  return (
    <ModalPortal>
      <div className="modal-shell">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="card card-lg modal-box sm:max-w-lg">
          <div className="px-5 sm:px-6 py-4 border-b border-line bg-surface-2 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="min-w-0">
              <h2 className="text-sm font-bold uppercase tracking-wider t-body truncate">Pay Salary</h2>
              <p className="t-faint text-[10px] font-semibold uppercase tracking-wider mt-0.5 truncate">
                {row.employee.fullName} · {formatMonthKey(month)}
              </p>
            </div>
            <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="Close"><X size={18} /></button>
          </div>

          <form onSubmit={submit} className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
            {/* Daily rate info badge */}
            <div className="flex items-center justify-between px-3 py-2 bg-brand-soft border border-brand-border rounded-xl text-xs t-brand font-medium">
              <span>Standard 30-Day Per-Day Rate:</span>
              <strong className="font-mono">Rs. {Math.round(perDaySalary).toLocaleString()} / day</strong>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Base salary (Rs.)</label>
                <input type="number" min="0" value={form.baseSalary}
                  onChange={e => handleBaseSalaryChange(e.target.value)} className="field" />
              </div>
              <div>
                <label className="label">Allowance (Days)</label>
                <input type="number" min="0" max="30" value={form.allowanceDays}
                  placeholder="e.g. 1, 2, 3 days"
                  onChange={e => handleAllowanceDaysChange(e.target.value)} className="field" />
              </div>
              <div>
                <label className="label">Allowances Amount (Rs.)</label>
                <input type="number" min="0" value={form.allowances}
                  onChange={e => setForm({ ...form, allowances: e.target.value })} className="field" />
              </div>
              <div>
                <label className="label">Absent Days</label>
                <input type="number" min="0" max="31" value={form.absentDays}
                  placeholder="e.g. 1, 2, 3 days"
                  onChange={e => handleAbsentDaysChange(e.target.value)} className="field" />
              </div>
              <div>
                <label className="label">Absence Deduction (Rs.)</label>
                <input type="number" min="0" value={form.absenceDeduction}
                  onChange={e => setForm({ ...form, absenceDeduction: e.target.value })} className="field" />
              </div>
              <div>
                <label className="label">Tax deduction (Rs.)</label>
                <input type="number" min="0" value={form.taxDeduction}
                  onChange={e => setForm({ ...form, taxDeduction: e.target.value })} className="field" />
              </div>
              <div>
                <label className="label">Security Deposit (Rs.)</label>
                <input type="number" min="0" value={form.securityDeposit}
                  placeholder="0"
                  onChange={e => setForm({ ...form, securityDeposit: e.target.value })} className="field" />
                <span className="text-[10px] t-faint block mt-0.5">Held by school for security</span>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Other deduction (Rs.)</label>
                <input type="number" min="0" value={form.otherDeduction}
                  onChange={e => setForm({ ...form, otherDeduction: e.target.value })} className="field" />
              </div>
            </div>

            {row.advanceDeduction > 0 && (
              <div className="note note-warn flex items-start gap-2.5">
                <HandCoins size={15} className="flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{fmtPKR(row.advanceDeduction)}</strong> of outstanding advance will be recovered
                  from this payment automatically. It was already recorded as an expense when it was
                  handed over, so it is not charged again here.
                </span>
              </div>
            )}

            <div className="surface-muted rounded-2xl p-4 space-y-2">
              <Line label="Gross Earnings" value={gross} />
              {n(form.attendanceBonus) > 0 && (
                <Line label="Bonus" value={n(form.attendanceBonus)} tone="t-ok" />
              )}
              <Line label="Total Deductions" value={-deductions} tone="t-bad" />
              <div className="divider" />
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider t-body">Net Payable</span>
                  {rawNet > 0 && rawNet !== net && (
                    <span className="block text-[10px] t-faint">Rounded to next 10 from Rs. {rawNet.toLocaleString()}</span>
                  )}
                </div>
                <span className="text-base font-black t-body">{fmtPKR(net)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Amount paying now</label>
                <input type="number" min="0" max={net} value={form.amountPaid}
                  onChange={e => setForm({ ...form, amountPaid: e.target.value })}
                  className="field" placeholder={`Full — ${fmtPKR(net)}`} />
                <p className="t-faint text-[10px] mt-1">Leave blank to pay the full net salary.</p>
              </div>
              <div>
                <label className="label">Method</label>
                <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="field">
                  {['Bank Transfer', 'Cash', 'Cheque'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Remarks</label>
              <input value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}
                className="field" placeholder="Optional" />
            </div>

            {isPartial && (
              <div className="note note-info">
                This is a part payment. <strong>{fmtPKR(net - paying)}</strong> will remain outstanding on
                this sheet and can be paid later.
              </div>
            )}
            {net < 0 && (
              <div className="note note-bad">Deductions exceed the salary — net pay cannot be negative.</div>
            )}

            <div className="modal-actions pt-4 border-t border-line">
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted border border-line rounded-xl">
                Cancel
              </button>
              <button type="submit" disabled={saving || net < 0 || paying <= 0} className="btn btn-primary disabled:opacity-50">
                <Wallet size={14} /> Pay {fmtPKR(paying)}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Edit Salary modal ───────────────────────────────────────────────────────
function EditSalaryModal({ row, month, onClose, onSaved }) {
  const [form, setForm] = useState({
    baseSalary: row.baseSalary ?? 0,
    allowances: row.allowances ?? 0,
    allowanceDays: '',
    absenceDeduction: row.absenceDeduction ?? 0,
    absentDays: row.absentDays ?? 0,
    advanceDeduction: row.advanceDeduction ?? 0,
    taxDeduction: row.taxDeduction ?? 0,
    securityDeposit: row.securityDeposit ?? 0,
    otherDeduction: row.otherDeduction ?? 0,
    attendanceBonus: row.attendanceBonus ?? 0,
    amountPaid: row.posted ? (row.amountPaid ?? '') : (row.amountPaid || ''),
    paymentMethod: row.paymentMethod || 'Bank Transfer',
    paymentDate: row.paymentDate ? new Date(row.paymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    status: row.status || (row.posted ? 'Paid' : 'Pending'),
    remarks: row.remarks || '',
  });
  const [autoStatus, setAutoStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  const perDaySalary = Math.round((Number(form.baseSalary || 0) / 30) * 100) / 100;

  const handleBaseSalaryChange = (val) => {
    const base = Number(val) || 0;
    const perDay = base / 30;
    const abs = Number(form.absentDays) || 0;
    const allowDays = Number(form.allowanceDays) || 0;
    setForm(prev => ({
      ...prev,
      baseSalary: val,
      absenceDeduction: abs > 0 ? Math.round(abs * perDay) : prev.absenceDeduction,
      allowances: allowDays > 0 ? Math.round(allowDays * perDay) : prev.allowances,
    }));
  };

  const handleAbsentDaysChange = (val) => {
    const abs = val === '' ? '' : Math.max(0, Number(val));
    const perDay = Number(form.baseSalary || 0) / 30;
    const ded = abs === '' || abs === 0 ? 0 : Math.round(abs * perDay);
    setForm(prev => ({ ...prev, absentDays: val, absenceDeduction: ded }));
  };

  const handleAllowanceDaysChange = (val) => {
    const days = val === '' ? '' : Math.max(0, Number(val));
    const perDay = Number(form.baseSalary || 0) / 30;
    const allow = days === '' || days === 0 ? 0 : Math.round(days * perDay);
    setForm(prev => ({ ...prev, allowanceDays: val, allowances: allow }));
  };

  const roundUp10 = (n) => (n <= 0 ? 0 : Math.ceil(n / 10) * 10);
  const n = (v) => Number(v) || 0;

  const deductions = n(form.absenceDeduction) + n(form.taxDeduction) + n(form.securityDeposit) + n(form.otherDeduction) + n(form.advanceDeduction);
  const gross = n(form.baseSalary) + n(form.allowances) + n(form.attendanceBonus);
  const rawNet = gross - deductions;
  const net = roundUp10(rawNet);

  const paidNum = form.amountPaid === '' ? (row.posted ? n(row.amountPaid) : 0) : n(form.amountPaid);

  const handleAmountPaidChange = (val) => {
    const p = val === '' ? 0 : Number(val);
    setForm(prev => {
      const next = { ...prev, amountPaid: val };
      if (autoStatus) {
        next.status = p >= net && net > 0 ? 'Paid' : (p > 0 ? 'Partial' : 'Pending');
      }
      return next;
    });
  };

  const setFullPayment = () => {
    setForm(prev => ({
      ...prev,
      amountPaid: net,
      status: 'Paid',
    }));
  };

  const setZeroPayment = () => {
    setForm(prev => ({
      ...prev,
      amountPaid: 0,
      status: 'Pending',
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (net < 0) {
      toast.error('Deductions exceed the salary — net pay cannot be negative');
      return;
    }
    if (paidNum > net) {
      toast.error(`Paid amount (Rs. ${paidNum.toLocaleString()}) cannot exceed net salary of Rs. ${net.toLocaleString()}`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        baseSalary: n(form.baseSalary),
        allowances: n(form.allowances),
        allowanceDays: form.allowanceDays !== '' ? n(form.allowanceDays) : undefined,
        absenceDeduction: n(form.absenceDeduction),
        absentDays: n(form.absentDays),
        advanceDeduction: n(form.advanceDeduction),
        taxDeduction: n(form.taxDeduction),
        securityDeposit: n(form.securityDeposit),
        otherDeduction: n(form.otherDeduction),
        attendanceBonus: n(form.attendanceBonus),
        amountPaid: paidNum,
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate || undefined,
        status: form.status,
        remarks: form.remarks || undefined,
      };

      if (row.posted && row.salaryRecord) {
        const { data } = await updateSalaryRecord(row.salaryRecord, payload);
        toast.success(data.message || 'Salary record updated successfully');
      } else {
        const { data } = await paySalary({
          employee: row.employee._id,
          month,
          ...payload,
          recoverAdvances: false, // advance is explicitly set via advanceDeduction
        });
        toast.success(data.message || 'Salary record saved successfully');
      }

      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save salary record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="modal-shell">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="card card-lg modal-box sm:max-w-xl max-h-[90vh] flex flex-col">
          <div className="px-5 sm:px-6 py-4 border-b border-line bg-surface-2 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Pencil size={15} className="t-brand" />
                <h2 className="text-sm font-bold uppercase tracking-wider t-body truncate">
                  Edit Salary Record
                </h2>
                <span className={`badge text-[9px] ${
                  row.status === 'Paid' ? 'badge-ok' : row.status === 'Partial' ? 'badge-warn' : 'badge-neutral'
                }`}>
                  {row.posted ? row.status : 'Unposted'}
                </span>
              </div>
              <p className="t-faint text-[10px] font-semibold uppercase tracking-wider mt-0.5 truncate">
                {row.employee.fullName} ({row.employee.employeeId}) · {row.employee.designation || 'Staff'} · {formatMonthKey(month)}
              </p>
            </div>
            <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={submit} className="px-5 sm:px-6 py-5 space-y-5 overflow-y-auto flex-1">
            {/* Daily rate info badge */}
            <div className="flex items-center justify-between px-3 py-2 bg-brand-soft border border-brand-border rounded-xl text-xs t-brand font-medium">
              <span>Standard 30-Day Per-Day Rate:</span>
              <strong className="font-mono">Rs. {Math.round(perDaySalary).toLocaleString()} / day</strong>
            </div>

            {/* Earnings Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider t-body flex items-center gap-1.5 t-brand">
                Earnings &amp; Additions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="label">Base Salary (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.baseSalary}
                    onChange={e => handleBaseSalaryChange(e.target.value)}
                    className="field"
                    required
                  />
                </div>
                <div>
                  <label className="label">Allowance (Days)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={form.allowanceDays}
                    placeholder="e.g. 1, 2, 3 days"
                    onChange={e => handleAllowanceDaysChange(e.target.value)}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label">Allowances Amount (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.allowances}
                    onChange={e => setForm({ ...form, allowances: e.target.value })}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label">Attendance Bonus (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.attendanceBonus}
                    onChange={e => setForm({ ...form, attendanceBonus: e.target.value })}
                    className="field"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Deductions Section */}
            <div className="space-y-3 pt-2 border-t border-line">
              <h3 className="text-xs font-bold uppercase tracking-wider t-body flex items-center gap-1.5 t-bad">
                Deductions &amp; Recoveries
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="label">Absent Days</label>
                  <input
                    type="number"
                    min="0"
                    max="31"
                    value={form.absentDays}
                    placeholder="0"
                    onChange={e => handleAbsentDaysChange(e.target.value)}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label">Absence Deduction (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.absenceDeduction}
                    onChange={e => setForm({ ...form, absenceDeduction: e.target.value })}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label">Advance Deduction (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.advanceDeduction}
                    onChange={e => setForm({ ...form, advanceDeduction: e.target.value })}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label">Tax Deduction (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.taxDeduction}
                    onChange={e => setForm({ ...form, taxDeduction: e.target.value })}
                    className="field"
                  />
                </div>
                <div>
                  <label className="label">Security Deposit (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.securityDeposit}
                    placeholder="0"
                    onChange={e => setForm({ ...form, securityDeposit: e.target.value })}
                    className="field"
                  />
                  <span className="text-[10px] t-faint block mt-0.5">Held by school for security</span>
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Other Deduction (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.otherDeduction}
                    onChange={e => setForm({ ...form, otherDeduction: e.target.value })}
                    className="field"
                  />
                </div>
              </div>
            </div>

            {/* Live Calculation summary */}
            <div className="surface-muted rounded-2xl p-4 space-y-2">
              <Line label="Gross Earnings" value={gross} />
              {n(form.attendanceBonus) > 0 && (
                <Line label="Bonus" value={n(form.attendanceBonus)} tone="t-ok" />
              )}
              <Line label="Total Deductions" value={-deductions} tone="t-bad" />
              <div className="divider" />
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider t-body">Net Payable</span>
                  {rawNet > 0 && rawNet !== net && (
                    <span className="block text-[10px] t-faint">Rounded to next 10 from Rs. {rawNet.toLocaleString()}</span>
                  )}
                </div>
                <span className="text-base font-black t-body">{fmtPKR(net)}</span>
              </div>
            </div>

            {/* Payment & Status Section */}
            <div className="space-y-3 pt-2 border-t border-line">
              <h3 className="text-xs font-bold uppercase tracking-wider t-body">
                Payment &amp; Settlement
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Amount Paid (Rs.)</label>
                    <div className="flex gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={setFullPayment}
                        className="text-brand hover:underline font-bold"
                      >
                        Full
                      </button>
                      <span className="t-faint">·</span>
                      <button
                        type="button"
                        onClick={setZeroPayment}
                        className="text-muted hover:underline font-bold"
                      >
                        Zero
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={net}
                    value={form.amountPaid}
                    onChange={e => handleAmountPaidChange(e.target.value)}
                    className="field"
                    placeholder={`Full — ${fmtPKR(net)}`}
                  />
                  <p className="t-faint text-[10px] mt-1">
                    Remaining balance: <strong className="t-warn font-semibold">{fmtPKR(Math.max(0, net - paidNum))}</strong>
                  </p>
                </div>

                <div>
                  <label className="label">Status</label>
                  <select
                    value={form.status}
                    onChange={e => {
                      setAutoStatus(false);
                      setForm({ ...form, status: e.target.value });
                    }}
                    className="field"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div>
                  <label className="label">Payment Method</label>
                  <select
                    value={form.paymentMethod}
                    onChange={e => setForm({ ...form, paymentMethod: e.target.value })}
                    className="field"
                  >
                    {['Bank Transfer', 'Cash', 'Cheque'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Payment Date</label>
                  <input
                    type="date"
                    value={form.paymentDate}
                    onChange={e => setForm({ ...form, paymentDate: e.target.value })}
                    className="field"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Remarks</label>
                  <input
                    value={form.remarks}
                    onChange={e => setForm({ ...form, remarks: e.target.value })}
                    className="field"
                    placeholder="Optional notes or reference number"
                  />
                </div>
              </div>
            </div>

            {net < 0 && (
              <div className="note note-bad">Deductions exceed the salary — net pay cannot be negative.</div>
            )}

            <div className="modal-actions pt-4 border-t border-line">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted border border-line rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || net < 0}
                className="btn btn-primary disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

const Line = ({ label, value, tone = 't-muted' }) => (
  <div className="flex justify-between items-center text-xs">
    <span className="t-muted">{label}</span>
    <span className={`font-semibold ${tone}`}>{fmtPKR(value)}</span>
  </div>
);

// ─── Advances ────────────────────────────────────────────────────────────────
function AdvancesTable({ data, reload, canManage }) {
  const cancel = async (a) => {
    if (!window.confirm(`Cancel the advance of ${fmtPKR(a.amount)} to ${a.employee?.fullName}?`)) return;
    try {
      await cancelAdvance(a._id);
      toast.success('Advance cancelled');
      reload();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to cancel the advance');
    }
  };

  return (
    <div className="card card-lg overflow-hidden">
      {data.advances.length === 0 ? (
        <div className="p-16 text-center t-faint flex flex-col items-center">
          <HandCoins size={40} className="t-muted mb-3" />
          <p className="t-muted font-bold uppercase tracking-wider text-sm">No advances recorded</p>
          <p className="text-xs t-faint mt-1">An advance is deducted from the staff member's next salary sheet automatically.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="w-full text-xs text-left rtable">
            <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Given</th>
                <th className="px-5 py-4 text-right">Amount</th>
                <th className="px-5 py-4 text-right">Recovered</th>
                <th className="px-5 py-4 text-right">Outstanding</th>
                <th className="px-5 py-4">Recover from</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line t-muted">
              {data.advances.map(a => (
                <tr key={a._id} className="hover:bg-surface-2 transition">
                  <td data-label="Employee" className="px-5 py-4 font-bold t-body">
                    <div>
                      {a.employee?.fullName || '—'}
                      <span className="block text-[10px] t-faint font-mono mt-0.5">{a.employee?.employeeId}</span>
                    </div>
                  </td>
                  <td data-label="Given" className="px-5 py-4">
                    {a.dateGiven ? new Date(a.dateGiven).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td data-label="Amount" className="px-5 py-4 text-right font-bold t-body">{fmtPKR(a.amount)}</td>
                  <td data-label="Recovered" className="px-5 py-4 text-right t-ok">{fmtPKR(a.amountRecovered)}</td>
                  <td data-label="Outstanding" className="px-5 py-4 text-right t-warn font-semibold">{fmtPKR(a.outstanding)}</td>
                  <td data-label="Recover from" className="px-5 py-4">{formatMonthKey(a.recoverFromMonth)}</td>
                  <td data-label="Status" className="px-5 py-4">
                    <span className={`badge ${a.status === 'Recovered' ? 'badge-ok' : a.status === 'Cancelled' ? 'badge-neutral' : 'badge-warn'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td data-actions="" className="px-5 py-4">
                    <div className="row-actions">
                      {canManage && a.status === 'Outstanding' && a.amountRecovered === 0 && (
                        <button onClick={() => cancel(a)} className="icon-btn icon-btn-danger" title="Cancel advance">
                          <Trash2 size={14} />
                        </button>
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
  );
}

// ─── Advance modal ───────────────────────────────────────────────────────────
function AdvanceModal({ month, onClose, onSaved }) {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    employee: '', amount: '', reason: '',
    recoverFromMonth: shiftMonthKey(month, 1), monthlyInstalment: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEmployees({ limit: 500 })
      .then(r => setEmployees((r.data.employees || []).filter(e => e.status === 'Active')))
      .catch(() => toast.error('Failed to load the staff list'));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createAdvance({
        employee: form.employee,
        amount: Number(form.amount),
        reason: form.reason || undefined,
        recoverFromMonth: form.recoverFromMonth,
        monthlyInstalment: form.monthlyInstalment === '' ? 0 : Number(form.monthlyInstalment),
      });
      toast.success('Advance recorded');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record the advance');
    } finally { setSaving(false); }
  };

  return (
    <ModalPortal>
      <div className="modal-shell">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="card card-lg modal-box sm:max-w-md">
          <div className="px-5 sm:px-6 py-4 border-b border-line bg-surface-2 flex items-center justify-between gap-3 flex-shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-wider t-body truncate">Give Salary Advance</h2>
            <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="Close"><X size={18} /></button>
          </div>

          <form onSubmit={submit} className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
            <div>
              <label className="label">Employee</label>
              <select required value={form.employee} onChange={e => setForm({ ...form, employee: e.target.value })} className="field">
                <option value="">Select a staff member</option>
                {employees.map(e => (
                  <option key={e._id} value={e._id}>{e.fullName} — {e.designation}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Amount (Rs.)</label>
                <input required type="number" min="1" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })} className="field" />
              </div>
              <div>
                <label className="label">Recover from</label>
                <input required type="month" value={form.recoverFromMonth}
                  onChange={e => setForm({ ...form, recoverFromMonth: e.target.value })} className="field" />
              </div>
            </div>
            <div>
              <label className="label">Monthly instalment (optional)</label>
              <input type="number" min="0" value={form.monthlyInstalment}
                onChange={e => setForm({ ...form, monthlyInstalment: e.target.value })}
                className="field" placeholder="Blank — recover it all at once" />
            </div>
            <div>
              <label className="label">Reason</label>
              <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                className="field" placeholder="Optional" />
            </div>

            <div className="note note-info">
              The advance is recorded as an expense today, on the day the cash is handed over. It is then
              deducted from the salary sheet from <strong>{formatMonthKey(form.recoverFromMonth)}</strong> —
              a deduction, not a second expense, so the money is only counted once.
            </div>

            <div className="modal-actions pt-4 border-t border-line">
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted border border-line rounded-xl">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-50">
                <HandCoins size={14} /> Record Advance
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
