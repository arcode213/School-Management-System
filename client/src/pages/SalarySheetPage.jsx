import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Wallet, HandCoins, Printer, Plus, X, Check, Trash2, RefreshCw, Lock, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { getEmployees } from '../api/employees';
import {
  getSalarySheet, paySalary, getAdvances, createAdvance, cancelAdvance, getClosedMonths,
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
  const [slipRow, setSlipRow] = useState(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);

  const isClosed = closedKeys.includes(month);
  const canPay = can('salaries', 'create');
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
          sheet={sheet} loading={loading} isClosed={isClosed} canPay={canPay}
          onPay={setPayRow} onSlip={setSlipRow}
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

const getDaysInMonth = (m) => {
  if (!m) return 30;
  const parts = m.split('-');
  const year = Number(parts[0]);
  const monthNum = Number(parts[1]);
  return new Date(year, monthNum, 0).getDate();
};

const getWorkingDaysInMonth = (m) => {
  if (!m) return 26;
  const parts = m.split('-');
  const year = Number(parts[0]);
  const monthNum = Number(parts[1]);
  const totalDays = new Date(year, monthNum, 0).getDate();
  let workingDays = 0;
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, monthNum - 1, day);
    if (date.getDay() !== 0) { // 0 is Sunday
      workingDays++;
    }
  }
  return workingDays;
};

// ─── Sheet ───────────────────────────────────────────────────────────────────
function SheetTable({ sheet, loading, isClosed, canPay, onPay, onSlip }) {
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
                    <span className="block text-[10px] t-faint font-mono mt-0.5">
                      {r.employee.employeeId} · {r.employee.designation}
                      {r.attendanceBonus > 0 && (
                        <span className="text-ok font-semibold ml-1.5" title={r.employee.designation === 'Teacher' ? "No absences reward" : "No absences bonus"}>
                          (incl. {r.employee.designation === 'Teacher' ? 'reward' : 'bonus'} {fmtPKR(r.attendanceBonus)})
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td data-label="Base" className="px-5 py-4 text-right">{fmtPKR(r.baseSalary)}</td>
                <td data-label="Allowances" className="px-5 py-4 text-right t-ok">{fmtPKR(r.allowances)}</td>
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
                    {canPay && !isClosed && r.outstanding > 0 && (
                      <button onClick={() => onPay(r)} className="btn btn-ok btn-sm">
                        <Wallet size={12} /> Pay
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
    allowances: row.allowances,
    absenceDeduction: row.absenceDeduction || 0,
    taxDeduction: row.taxDeduction || 0,
    otherDeduction: row.otherDeduction || 0,
    absentDays: row.absentDays || 0,
    attendanceBonus: row.attendanceBonus || 0,
    amountPaid: '',
    paymentMethod: 'Bank Transfer',
    remarks: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (row.employee.designation === 'Teacher') {
      const baseSalaryNum = Number(form.baseSalary) || 0;
      const days = getWorkingDaysInMonth(month);
      const oneDaySalary = Math.round((baseSalaryNum / days) / 10) * 10;
      const absDays = Number(form.absentDays) || 0;

      let deduction = 0;
      let bonus = 0;

      if (absDays === 0) {
        bonus = oneDaySalary;
        deduction = 0;
      } else if (absDays === 1) {
        bonus = 0;
        deduction = 0;
      } else {
        bonus = 0;
        deduction = Math.round(((absDays - 1) * oneDaySalary) / 10) * 10;
      }

      setForm(prev => {
        if (prev.absenceDeduction === deduction && prev.attendanceBonus === bonus) return prev;
        return { ...prev, absenceDeduction: deduction, attendanceBonus: bonus };
      });
    }
  }, [form.absentDays, form.baseSalary, row.employee.designation, month]);

  const n = (v) => Number(v) || 0;
  const deductions = n(form.absenceDeduction) + n(form.taxDeduction) + n(form.otherDeduction) + n(row.advanceDeduction);
  const net = n(form.baseSalary) + n(form.allowances) + n(form.attendanceBonus) - deductions;
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
        absenceDeduction: n(form.absenceDeduction),
        taxDeduction: n(form.taxDeduction),
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Base salary</label>
                <input type="number" min="0" value={form.baseSalary}
                  onChange={e => setForm({ ...form, baseSalary: e.target.value })} className="field" />
              </div>
              <div>
                <label className="label">Allowances</label>
                <input type="number" min="0" value={form.allowances}
                  onChange={e => setForm({ ...form, allowances: e.target.value })} className="field" />
              </div>
              <div>
                <label className="label">Absent days</label>
                <input type="number" min="0" max="31" value={form.absentDays}
                  onChange={e => setForm({ ...form, absentDays: e.target.value })} className="field" />
              </div>
              <div>
                <label className="label">{row.employee.designation === 'Teacher' ? 'Penalty' : 'Absence deduction'}</label>
                <input type="number" min="0" value={form.absenceDeduction}
                  disabled={row.employee.designation === 'Teacher'}
                  onChange={e => setForm({ ...form, absenceDeduction: e.target.value })} className="field" />
              </div>
              <div>
                <label className="label">Tax deduction</label>
                <input type="number" min="0" value={form.taxDeduction}
                  onChange={e => setForm({ ...form, taxDeduction: e.target.value })} className="field" />
              </div>
              <div>
                <label className="label">Other deduction</label>
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
              <Line label="Gross" value={n(form.baseSalary) + n(form.allowances)} />
              {n(form.attendanceBonus) > 0 && (
                <Line label={row.employee.designation === 'Teacher' ? 'Reward' : 'Attendance Bonus'} value={n(form.attendanceBonus)} tone="t-ok" />
              )}
              <Line label="Total deductions" value={-deductions} tone="t-bad" />
              <div className="divider" />
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider t-body">Net payable</span>
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
