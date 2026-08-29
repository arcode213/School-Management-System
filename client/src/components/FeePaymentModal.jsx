import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateFee } from '../api/fees';
import ModalPortal from './ModalPortal';
import { MONTHS, parseStartMonth, monthAt, absMonth, parseStartYear } from '../utils/feeMonths';

export default function FeePaymentModal({ open, onClose, feeRecord, onSaved }) {
  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm();
  const [edited, setEdited] = useState({ monthly: false, annual: false });

  const newDiscount = Number(watch('discount') || 0);
  const monthlyPay = Number(watch('monthlyPay') || 0);
  const annualPay = Number(watch('annualPay') || 0);
  const payingTotal = monthlyPay + annualPay;

  const annualDue = feeRecord ? (feeRecord.annualBalance ?? 0) : 0;
  const monthlyDueRaw = feeRecord ? (feeRecord.monthlyBalance ?? feeRecord.balance ?? 0) : 0;
  const monthlyDue = Math.max(0, monthlyDueRaw - newDiscount);
  const totalDue = monthlyDue + annualDue;
  const hasAnnual = annualDue > 0;
  const carriedAnnual = feeRecord
    ? (feeRecord.annualCarriedForward || 0) + (feeRecord.previousAnnualDues || 0)
    : 0;

  const recurring = feeRecord ? (Number(feeRecord.tuitionFee) || 0) + (Number(feeRecord.transportFee) || 0) + (Number(feeRecord.miscFee) || 0) : 0;
  const rangeStart = feeRecord ? parseStartMonth(feeRecord.dueMonthRange, feeRecord.feeMonth) : '';
  const startIdx = MONTHS.indexOf(rangeStart);
  const feeIdx = feeRecord ? MONTHS.indexOf(feeRecord.feeMonth) : -1;
  const feeYear = Number(feeRecord?.feeYear) || new Date().getFullYear();
  const defaultStartYear = startIdx <= feeIdx ? feeYear : feeYear - 1;
  const startYear = parseStartYear(feeRecord?.dueMonthRange, defaultStartYear);
  const startAbs = absMonth(rangeStart, startYear);
  const feeAbs = absMonth(feeRecord?.feeMonth || '', feeYear);
  const totalMonths = Math.max(1, feeAbs - startAbs + 1);

  const monthlyTotal = feeRecord?.monthlyTotal ?? Math.max(0, (feeRecord?.totalAmount || 0) - (feeRecord?.annualTotal || 0));
  const priorPaidMonthly = Math.max(0, (Number(feeRecord?.amountPaid) || 0) - (Number(feeRecord?.annualPaid) || 0));
  const priorDiscount = Number(feeRecord?.discount || 0);
  const priorSettledMonthly = priorPaidMonthly + priorDiscount;

  const alreadyPaidMonths = recurring > 0 ? Math.min(totalMonths, Math.floor(priorSettledMonthly / recurring)) : 0;
  const remainingMonths = Math.max(0, totalMonths - alreadyPaidMonths);
  const canPayByMonth = recurring > 0 && remainingMonths > 1;

  const finalDiscount = priorDiscount + newDiscount;
  const finalMonthlyPaid = priorPaidMonthly + monthlyPay;
  const finalMonthlySettled = finalMonthlyPaid + finalDiscount;
  const monthsPaidAfter = recurring > 0 ? Math.min(totalMonths, Math.floor(finalMonthlySettled / recurring)) : 0;
  
  const settlesThrough = monthsPaidAfter >= totalMonths
    ? feeRecord?.feeMonth
    : (monthsPaidAfter > 0 ? MONTHS[(((startAbs + monthsPaidAfter - 1) % 12) + 12) % 12] : null);
  const carriesFrom = monthsPaidAfter < totalMonths ? MONTHS[(((startAbs + monthsPaidAfter) % 12) + 12) % 12] : null;

  const selectMonths = (value) => {
    const n = Number(value);
    if (!n) return;
    const targetSettledAmount = (alreadyPaidMonths + n) * recurring;
    const netCashNeeded = Math.max(0, targetSettledAmount - priorPaidMonthly - (priorDiscount + newDiscount));
    const amt = n >= remainingMonths ? monthlyDue : Math.min(monthlyDue, netCashNeeded);
    setEdited(e => ({ ...e, monthly: true }));
    setValue('monthlyPay', amt, { shouldValidate: true });
  };

  const finalPaid = (Number(feeRecord?.amountPaid) || 0) + payingTotal;
  const netPayable = feeRecord ? feeRecord.totalAmount - newDiscount : 0;
  let nextStatus = 'Unpaid';
  if (finalPaid >= netPayable && netPayable > 0) nextStatus = 'Paid';
  else if (finalPaid > 0) nextStatus = 'Partial';

  useEffect(() => {
    if (open && feeRecord) {
      reset({
        discount: 0,
        monthlyPay: Math.max(0, feeRecord.monthlyBalance ?? feeRecord.balance ?? 0),
        annualPay: feeRecord.annualBalance ?? 0,
        paymentMethod: 'Cash',
        remarks: '',
      });
      setEdited({ monthly: false, annual: false });
    }
  }, [open, feeRecord, reset]);

  useEffect(() => {
    if (!open || !feeRecord || edited.monthly) return;
    setValue('monthlyPay', Math.max(0, monthlyDueRaw - newDiscount));
  }, [open, feeRecord, edited.monthly, newDiscount, monthlyDueRaw, setValue]);

  const onSubmit = async (data) => {
    const monthlyPart = Math.max(0, Number(data.monthlyPay) || 0);
    const annualPart = Math.max(0, Number(data.annualPay) || 0);
    if (monthlyPart + annualPart <= 0 && newDiscount <= 0) {
      toast.error('Enter an amount to receive');
      return;
    }
    try {
      const payload = {
        discount: finalDiscount,
        amountPaid: (feeRecord.amountPaid || 0) + monthlyPart + annualPart,
        annualPaid: (feeRecord.annualPaid || 0) + annualPart,
        paymentDate: new Date(),
        paymentMethod: data.paymentMethod,
        remarks: data.remarks
      };
      await updateFee(feeRecord._id, payload);
      toast.success('Payment recorded successfully');
      onSaved();
      onClose();
    } catch (err) {
      toast.error('Failed to record payment');
    }
  };

  if (!open || !feeRecord) return null;
  const student = feeRecord.studentInfo || feeRecord.student || {};

  return (
    <ModalPortal>
    <div className="modal-shell">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="card card-lg modal-box sm:max-w-md t-body">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line bg-surface-2 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10 flex-shrink-0">
              <CreditCard className="t-body w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider t-body truncate">Record Fee Receipt</h2>
          </div>
          <button onClick={onClose} className="icon-btn flex-shrink-0" aria-label="Close"><X size={20} /></button>
        </div>

        <form id="payment-form" onSubmit={handleSubmit(onSubmit)} className="px-5 sm:px-6 py-5 space-y-4 overflow-y-auto">
          {/* Summary Panel */}
          <div className="bg-surface-2 rounded-2xl p-4 border border-line flex flex-col gap-2.5">
            <div className="flex justify-between text-xs gap-3">
              <span className="t-muted">Student Name:</span>
              <span className="font-bold t-body text-right">
                {student.fullName || 'Student'} ({student.class ? `Class ${student.class}` : ''})
                {student.fatherName && (
                  <span className="block text-[10px] font-medium t-faint">s/o {student.fatherName}</span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="t-muted">Fee Months:</span>
              <span className="font-bold t-body">{feeRecord.feeMonth} {feeRecord.feeYear}</span>
            </div>
            <div className="h-px bg-surface-2 my-1" />
            <div className="flex justify-between text-xs">
              <span className="t-muted">Total Billed:</span>
              <span className="t-muted font-semibold">Rs. {feeRecord.totalAmount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="t-muted">Prior Payments/Discount:</span>
              <span className="t-muted font-semibold">Rs. {((feeRecord.amountPaid || 0) + (feeRecord.discount || 0)).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="t-faint">Monthly Arrears Outstanding:</span>
              <span className="t-muted">Rs. {monthlyDue.toLocaleString()}</span>
            </div>
            {hasAnnual && (
              <div className="flex justify-between text-[11px]">
                <span className="t-faint">Annual Fee Outstanding:</span>
                <span className="t-brand font-semibold">Rs. {annualDue.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-black t-bad mt-1.5 text-base border-t border-line pt-2">
              <span>Current Due Balance:</span>
              <span>Rs. {totalDue.toLocaleString()}</span>
            </div>
          </div>

          {canPayByMonth && (
            <div>
              <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Installment Split (Number of Months)</label>
              <select onChange={e => selectMonths(e.target.value)} defaultValue=""
                className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
              >
                <option value="" disabled className="bg-surface-2">Select months to pay…</option>
                {Array.from({ length: remainingMonths }, (_, i) => i + 1).map(n => {
                  const thru = (alreadyPaidMonths + n >= totalMonths) ? feeRecord.feeMonth : monthAt(startAbs + alreadyPaidMonths + n - 1);
                  const isAll = n === remainingMonths;
                  return (
                    <option key={n} value={n} className="bg-surface-2">
                      {n} Month{n > 1 ? 's' : ''} — settles through {thru}{isAll ? ' (clears months)' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] t-faint mt-1.5 font-medium leading-relaxed">
                Tuition/recurring cost: Rs. {recurring.toLocaleString()} / month. This auto-fills the payment fields.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">New Discount (Rs.)</label>
              <input type="number" min="0" max={monthlyDueRaw} {...register('discount')}
                className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">
                {hasAnnual ? 'Monthly Cash Paid (Rs.)' : 'Cash Received (Rs.)'}
              </label>
              <input
                type="number" min="0" max={monthlyDue}
                {...register('monthlyPay', {
                  onChange: () => setEdited(e => ({ ...e, monthly: true })),
                })}
                className="w-full text-xs bg-ok-soft border border-ok-border rounded-xl px-3 py-2.5 t-ok focus:outline-none focus:ring-2 focus:ring-brand font-bold"
              />
            </div>
          </div>

          {hasAnnual && (
            <div className="rounded-2xl border border-brand-border bg-brand-soft px-4 py-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold t-muted uppercase tracking-widest">Annual Fee Cash (Rs.)</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => { setEdited(e => ({ ...e, annual: true })); setValue('annualPay', annualDue); }}
                    className="text-[10px] t-brand hover:t-brand font-bold uppercase tracking-wider">Pay Full</button>
                  <button type="button"
                    onClick={() => { setEdited(e => ({ ...e, annual: true })); setValue('annualPay', 0); }}
                    className="text-[10px] t-faint hover:t-muted font-bold uppercase tracking-wider">Skip</button>
                </div>
              </div>
              <input
                type="number" min="0" max={annualDue}
                {...register('annualPay', {
                  onChange: () => setEdited(e => ({ ...e, annual: true })),
                })}
                className="w-full text-xs bg-surface-2 border border-brand-border rounded-xl px-3 py-2.5 t-brand focus:outline-none focus:ring-2 focus:ring-brand font-bold"
              />
              <p className="text-[10px] t-faint leading-normal font-medium">
                Unpaid annual balance Rs. {annualDue.toLocaleString()}
                {carriedAnnual > 0 && ` (includes Rs. ${carriedAnnual.toLocaleString()} forward dues)`}.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Payment Method</label>
              <select {...register('paymentMethod')} className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body outline-none focus:ring-2 focus:ring-brand cursor-pointer">
                <option value="Cash" className="bg-surface-2">Cash</option>
                <option value="Bank" className="bg-surface-2">Bank Deposit</option>
                <option value="Online" className="bg-surface-2">Online Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Remarks / Details</label>
              <input {...register('remarks')} className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" placeholder="e.g. Challan slip no." />
            </div>
          </div>

          <div className="flex justify-between items-center bg-surface-2 border border-line px-4 py-2.5 rounded-xl text-xs">
            <span className="t-muted">Total Receipt Value:</span>
            <span className="font-bold t-ok">Rs. {payingTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center bg-surface-2 border border-line px-4 py-2.5 rounded-xl text-xs">
            <span className="t-muted">Resulting Account Status:</span>
            <span className={`font-bold ${nextStatus === 'Paid' ? 't-ok' : nextStatus === 'Partial' ? 't-warn' : 't-bad'}`}>{nextStatus}</span>
          </div>

          {canPayByMonth && settlesThrough && (
            <div className="text-[10px] bg-brand-soft border border-brand-border t-brand rounded-xl px-3.5 py-2.5 leading-relaxed font-semibold">
              Settles through <strong>{settlesThrough}</strong>.
              {carriesFrom
                ? <> Remaining <strong>{carriesFrom} – {feeRecord.feeMonth}</strong> will carry to the next challan as outstanding dues.</>
                : <> This clears all monthly splits on this challan.</>}
            </div>
          )}
        </form>

        <div className="px-5 sm:px-6 py-4 border-t border-line modal-actions bg-surface-2 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted hover:bg-surface-3 border border-line rounded-xl transition">Cancel</button>
          <button type="submit" form="payment-form" disabled={isSubmitting || (payingTotal === 0 && newDiscount === 0)} className="btn btn-primary disabled:opacity-50">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
