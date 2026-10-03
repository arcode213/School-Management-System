import { useEffect, useState } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ModalPortal from '../ModalPortal';
import { getSalaryRecord } from '../../api/accounts';
import { fmtPKR, formatMonthKey } from '../../utils/money';

/**
 * The printable salary slip.
 *
 * Printed by opening a plain HTML document in a new window, the same way the
 * student record and the dues report already are. That keeps the slip's layout
 * independent of the screen's theme — a slip has to come out black on white
 * whatever the portal is set to — and needs no PDF dependency on the client.
 */
const esc = (v) => String(v ?? '—')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const slipHTML = (rec, month, campusName) => {
  const row = (label, value, cls = '') =>
    `<tr><td class="lbl">${esc(label)}</td><td class="val ${cls}">${esc(value)}</td></tr>`;

  const deductionRows = [
    rec.advanceDeduction > 0 ? row('Salary Advance Recovery', fmtPKR(rec.advanceDeduction), 'neg') : '',
    rec.absenceDeduction > 0 ? row(rec.employee?.designation === 'Teacher' ? `Penalty (${rec.absentDays || 0} day${rec.absentDays === 1 ? '' : 's'})` : `Absence (${rec.absentDays || 0} day${rec.absentDays === 1 ? '' : 's'})`, fmtPKR(rec.absenceDeduction), 'neg') : '',
    rec.securityDeposit > 0 ? row('Security Deposit (Held)', fmtPKR(rec.securityDeposit), 'neg') : '',
    rec.taxDeduction > 0 ? row('Tax', fmtPKR(rec.taxDeduction), 'neg') : '',
    rec.otherDeduction > 0 ? row('Other', fmtPKR(rec.otherDeduction), 'neg') : '',
  ].filter(Boolean).join('');

  const paymentRows = (rec.payments || []).map(p => `
    <tr>
      <td>${esc(new Date(p.date).toLocaleDateString('en-GB'))}</td>
      <td>${esc(p.method)}</td>
      <td class="r">${esc(fmtPKR(p.amount))}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <title>Salary Slip — ${esc(rec.employee?.fullName)} — ${esc(formatMonthKey(month))}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1e293b;margin:0;padding:28px}
      .doc{max-width:720px;margin:0 auto}
      .head{text-align:center;border-bottom:3px solid #4f46e5;padding-bottom:12px;margin-bottom:18px}
      .head h1{margin:0;font-size:20px}
      .head h2{margin:4px 0 0;font-size:13px;font-weight:600;color:#475569}
      .meta{display:flex;justify-content:space-between;font-size:12px;color:#475569;margin-bottom:16px;gap:16px;flex-wrap:wrap}
      .meta strong{color:#1e293b}
      h3{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#4f46e5;margin:18px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;font-size:12.5px}
      td{padding:5px 0;vertical-align:top}
      td.lbl{color:#64748b;width:60%}
      td.val{font-weight:600;text-align:right}
      td.neg{color:#b91c1c}
      td.pos{color:#047857}
      table.hist{margin-top:6px}
      table.hist th,table.hist td{border:1px solid #cbd5e1;padding:5px 8px;text-align:left;font-size:11px}
      table.hist th{background:#f1f5f9;text-transform:uppercase;font-size:10px;letter-spacing:.03em}
      table.hist td.r{text-align:right}
      .net{display:flex;justify-content:space-between;align-items:center;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:12px 16px;margin-top:16px}
      .net .l{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#3730a3}
      .net .v{font-size:22px;font-weight:800;color:#3730a3}
      .sign{display:flex;justify-content:space-between;margin-top:56px;font-size:11px;color:#475569;gap:24px}
      .sign div{border-top:1px solid #94a3b8;padding-top:6px;width:40%;text-align:center}
      .foot{margin-top:22px;text-align:center;font-size:10px;color:#94a3b8}
      @media print{body{padding:0}@page{margin:14mm}}
    </style></head><body>
    <div class="doc">
      <div class="head">
        <h1>${esc(campusName || 'School Management System')}</h1>
        <h2>Salary Slip — ${esc(formatMonthKey(month))}</h2>
      </div>

      <div class="meta">
        <span><strong>${esc(rec.employee?.fullName)}</strong><br/>${esc(rec.employee?.designation)}${rec.employee?.department ? ' · ' + esc(rec.employee.department) : ''}</span>
        <span style="text-align:right">Employee ID: <strong>${esc(rec.employee?.employeeId)}</strong><br/>Status: <strong>${esc(rec.status)}</strong></span>
      </div>

      <h3>Earnings</h3>
      <table>
        ${row('Basic Salary', fmtPKR(rec.baseSalary), 'pos')}
        ${rec.allowances > 0 ? row('Allowances', fmtPKR(rec.allowances), 'pos') : ''}
        ${rec.attendanceBonus > 0 ? row(rec.employee?.designation === 'Teacher' ? 'Reward' : 'Attendance Bonus (0 leaves)', fmtPKR(rec.attendanceBonus), 'pos') : ''}
        ${row('Gross', fmtPKR((rec.baseSalary || 0) + (rec.allowances || 0) + (rec.attendanceBonus || 0)), 'pos')}
      </table>

      <h3>Deductions</h3>
      <table>
        ${deductionRows || row('No deductions', fmtPKR(0))}
        ${row('Total Deductions', fmtPKR(rec.deductions || 0), 'neg')}
      </table>

      <div class="net">
        <span class="l">Net Salary</span>
        <span class="v">${esc(fmtPKR(rec.netSalary))}</span>
      </div>

      ${paymentRows ? `<h3>Payments</h3>
      <table class="hist">
        <thead><tr><th>Date</th><th>Method</th><th class="r">Amount</th></tr></thead>
        <tbody>${paymentRows}</tbody>
      </table>` : ''}

      ${rec.outstanding > 0 ? `<p style="margin-top:10px;font-size:12px;color:#b45309"><strong>Outstanding: ${esc(fmtPKR(rec.outstanding))}</strong></p>` : ''}

      <div class="sign">
        <div>Employee Signature</div>
        <div>Authorised Signature</div>
      </div>

      <div class="foot">Generated ${esc(new Date().toLocaleString('en-GB'))}</div>
    </div>
    <script>window.onload=function(){window.print()}</script>
    </body></html>`;
};

export default function SalarySlip({ row, month, onClose }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!row?.salaryRecord) { setLoading(false); return; }
    getSalaryRecord(row.salaryRecord)
      .then(r => setRecord(r.data))
      .catch(() => toast.error('Failed to load the salary record'))
      .finally(() => setLoading(false));
  }, [row]);

  const print = () => {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Allow pop-ups to print the salary slip'); return; }
    win.document.write(slipHTML(record, month, record?.campus?.name));
    win.document.close();
  };

  return (
    <ModalPortal>
      <div className="modal-shell">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
        <div className="card card-lg modal-box sm:max-w-md">
          <div className="px-5 sm:px-6 py-4 border-b border-line bg-surface-2 flex items-center justify-between gap-3 flex-shrink-0">
            <h2 className="text-sm font-bold uppercase tracking-wider t-body truncate">Salary Slip</h2>
            <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="Close"><X size={18} /></button>
          </div>

          <div className="px-5 sm:px-6 py-5 space-y-3 overflow-y-auto">
            {loading ? (
              <div className="py-10 flex justify-center">
                <Loader2 className="animate-spin t-muted" size={24} />
              </div>
            ) : !record ? (
              <p className="t-muted text-sm">This salary has not been posted yet, so there is no slip to print.</p>
            ) : (
              <>
                <div className="surface-muted rounded-2xl p-4 space-y-2">
                  <Row label="Employee" value={record.employee?.fullName} bold />
                  <Row label="Month" value={formatMonthKey(month)} />
                  <div className="divider" />
                  <Row label="Basic" value={fmtPKR(record.baseSalary)} />
                  <Row label="Allowances" value={fmtPKR(record.allowances || 0)} tone="t-ok" />
                  <Row label="Deductions" value={fmtPKR(record.deductions || 0)} tone="t-bad" />
                  <div className="divider" />
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider t-body">Net</span>
                    <span className="text-base font-black t-body">{fmtPKR(record.netSalary)}</span>
                  </div>
                  <Row label="Paid" value={fmtPKR(record.amountPaid)} tone="t-ok" />
                  {record.outstanding > 0 && (
                    <Row label="Outstanding" value={fmtPKR(record.outstanding)} tone="t-warn" />
                  )}
                </div>
                <p className="t-faint text-[11px] leading-relaxed">
                  The slip opens in a new window and prints black on white, whichever theme the portal is set to.
                </p>
              </>
            )}
          </div>

          <div className="px-5 sm:px-6 py-4 border-t border-line modal-actions flex-shrink-0">
            <button onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted border border-line rounded-xl">
              Close
            </button>
            <button onClick={print} disabled={!record} className="btn btn-primary disabled:opacity-50">
              <Printer size={14} /> Print Slip
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

const Row = ({ label, value, tone = 't-muted', bold }) => (
  <div className="flex justify-between items-center gap-3 text-xs">
    <span className="t-muted">{label}</span>
    <span className={`${bold ? 'font-bold t-body' : `font-semibold ${tone}`} text-right`}>{value}</span>
  </div>
);
