import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateFee } from '../api/fees';
import { MONTHS, parseStartMonth, monthAt } from '../utils/feeMonths';

export default function FeePaymentModal({ open, onClose, feeRecord, onSaved }) {
  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm();

  // Once the cashier edits an amount by hand we stop auto-filling it, so their
  // figure is never overwritten by a later recalculation (e.g. adding a discount).
  const [edited, setEdited] = useState({ monthly: false, annual: false });

  const newDiscount = Number(watch('discount') || 0);
  const monthlyPay = Number(watch('monthlyPay') || 0);
  const annualPay = Number(watch('annualPay') || 0);
  const payingTotal = monthlyPay + annualPay;

  // ─── The two buckets ─────────────────────────────────────────────────────────
  // The server keeps the outstanding amount split between the recurring monthly
  // charges and the annual fee, and each is paid on its own line here. Challans
  // written before that split have no monthlyBalance — their whole balance was
  // monthly, which is what the fallback says.
  const annualDue = feeRecord ? (feeRecord.annualBalance ?? 0) : 0;
  const monthlyDueRaw = feeRecord ? (feeRecord.monthlyBalance ?? feeRecord.balance ?? 0) : 0;
  // A discount only ever reduces the monthly side (that is how the server totals it).
  const monthlyDue = Math.max(0, monthlyDueRaw - newDiscount);
  const totalDue = monthlyDue + annualDue;
  const hasAnnual = annualDue > 0;
  // Annual fee rolled in from an earlier challan — this session's own unpaid annual
  // fee (tracked as a share of annualFee) plus anything left from a prior session.
  const carriedAnnual = feeRecord
    ? (feeRecord.annualCarriedForward || 0) + (feeRecord.previousAnnualDues || 0)
    : 0;

  // ─── Month-based payment helper ──────────────────────────────────
  // A multi-month challan (e.g. "April - June") can be paid a few months at a
  // time. The recurring monthly rate is tuition + transport + misc.
  const recurring = feeRecord ? (feeRecord.tuitionFee || 0) + (feeRecord.transportFee || 0) + (feeRecord.miscFee || 0) : 0;
  const rangeStart = feeRecord ? parseStartMonth(feeRecord.dueMonthRange, feeRecord.feeMonth) : '';
  const startIdx = MONTHS.indexOf(rangeStart);
  const feeIdx = feeRecord ? MONTHS.indexOf(feeRecord.feeMonth) : -1;
  let totalMonths = 1;
  if (startIdx >= 0 && feeIdx >= 0) { let s = feeIdx - startIdx; if (s < 0) s += 12; totalMonths = s + 1; }

  // What the MONTHLY bucket owes and has already received, independent of any
  // annual-fee money on the same challan.
  const monthlyTotal = feeRecord?.monthlyTotal ?? Math.max(0, (feeRecord?.totalAmount || 0) - (feeRecord?.annualTotal || 0));
  const monthlyAlreadyPaid = Math.max(0, monthlyTotal - monthlyDueRaw);
  const alreadyPaidMonths = recurring > 0 ? Math.min(totalMonths, Math.floor(monthlyAlreadyPaid / recurring)) : 0;
  const remainingMonths = Math.max(0, totalMonths - alreadyPaidMonths);
  const canPayByMonth = recurring > 0 && remainingMonths > 1;

  // Live preview of which months this payment settles. Uses the monthly share
  // only — annual-fee money settles no month, exactly as the server treats it.
  const monthlyPaidAfter = Math.min(Math.max(0, monthlyTotal - newDiscount), monthlyAlreadyPaid + monthlyPay);
  const monthsPaidAfter = recurring > 0 ? Math.min(totalMonths, Math.floor(monthlyPaidAfter / recurring)) : 0;
  const settlesThrough = monthsPaidAfter > 0 ? monthAt(startIdx + monthsPaidAfter - 1) : null;
  const carriesFrom = monthsPaidAfter < totalMonths ? monthAt(startIdx + monthsPaidAfter) : null;

  // Picking N months fills in the monthly amount (still editable afterwards).
  const selectMonths = (value) => {
    const n = Number(value);
    if (!n) return;
    const amt = n >= remainingMonths ? monthlyDue : Math.min(monthlyDue, recurring * n);
    setEdited(e => ({ ...e, monthly: true }));
    setValue('monthlyPay', amt, { shouldValidate: true });
  };

  // Predict new status (mirrors the server pre-save recalculation).
  const finalDiscount = (feeRecord?.discount || 0) + newDiscount;
  const finalPaid = (feeRecord?.amountPaid || 0) + payingTotal;
  const netPayable = feeRecord ? feeRecord.totalAmount - newDiscount : 0;
  let nextStatus = 'Unpaid';
  if (finalPaid >= netPayable && netPayable > 0) nextStatus = 'Paid';
  else if (finalPaid > 0) nextStatus = 'Partial';

  // Open with the full outstanding amount already worked out and filled in —
  // clearing the challan is the common case; anything less is an edit from here.
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

  // A discount lowers what the monthly side owes, so keep the (untouched)
  // suggested amount in step with it.
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
        // Both are running totals on the challan, not just this instalment.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
              <CreditCard className="text-white w-4 h-4" />
            </div>
            <h2 className="font-semibold text-slate-800">Record Payment</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form id="payment-form" onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-2">
            <div className="flex justify-between text-sm gap-3">
              <span className="text-slate-500 flex-shrink-0">Student:</span>
              <span className="font-semibold text-slate-800 text-right">
                {student.fullName || 'Student'} ({student.class || ''})
                {student.fatherName && (
                  <span className="block text-xs font-normal text-slate-500">s/o {student.fatherName}</span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Fee Month:</span>
              <span className="font-semibold text-slate-800">{feeRecord.feeMonth} {feeRecord.feeYear}</span>
            </div>
            <div className="h-px bg-slate-200 my-1" />
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Fee:</span>
              <span className="text-slate-700">Rs. {feeRecord.totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Prev Paid/Discount:</span>
              <span className="text-slate-700">Rs. {((feeRecord.amountPaid || 0) + (feeRecord.discount || 0)).toLocaleString()}</span>
            </div>
            {/* What is still owed, split the same way the payment is collected below. */}
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Monthly outstanding:</span>
              <span className="text-slate-600">Rs. {monthlyDue.toLocaleString()}</span>
            </div>
            {hasAnnual && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Annual fee outstanding:</span>
                <span className="text-indigo-600 font-medium">Rs. {annualDue.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-red-600 mt-1 text-base">
              <span>Current Due:</span>
              <span>Rs. {totalDue.toLocaleString()}</span>
            </div>
          </div>

          {canPayByMonth && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Pay for how many months?</label>
              <select onChange={e => selectMonths(e.target.value)} defaultValue=""
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="" disabled>Select months to pay…</option>
                {Array.from({ length: remainingMonths }, (_, i) => i + 1).map(n => {
                  const thru = monthAt(startIdx + alreadyPaidMonths + n - 1);
                  const isAll = n === remainingMonths;
                  return (
                    <option key={n} value={n}>
                      {n} month{n > 1 ? 's' : ''} — through {thru}{isAll ? ' (clears the months)' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Monthly fee Rs. {recurring.toLocaleString()} — this fills the monthly amount for you; you can still edit it.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">New Discount (Rs.)</label>
              <input type="number" min="0" max={monthlyDueRaw} {...register('discount')}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {hasAnnual ? 'Monthly Fee Paying (Rs.)' : 'Paying Amount (Rs.)'}
              </label>
              <input
                type="number" min="0" max={monthlyDue}
                {...register('monthlyPay', {
                  onChange: () => setEdited(e => ({ ...e, monthly: true })),
                })}
                className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 font-bold text-emerald-700"
              />
            </div>
          </div>

          {/* Annual fee — collected on its own line so it can be paid whenever the
              parent pays it, instead of only after every month is cleared. */}
          {hasAnnual && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-700">Annual Fee Paying (Rs.)</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => { setEdited(e => ({ ...e, annual: true })); setValue('annualPay', annualDue); }}
                    className="text-[11px] text-indigo-700 hover:underline font-medium">Pay full</button>
                  <button type="button"
                    onClick={() => { setEdited(e => ({ ...e, annual: true })); setValue('annualPay', 0); }}
                    className="text-[11px] text-slate-500 hover:underline">Skip</button>
                </div>
              </div>
              <input
                type="number" min="0" max={annualDue}
                {...register('annualPay', {
                  onChange: () => setEdited(e => ({ ...e, annual: true })),
                })}
                className="w-full border border-indigo-300 bg-white rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 font-bold text-indigo-700"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Outstanding annual fee Rs. {annualDue.toLocaleString()}
                {/* Carried-over annual fee sits in two places: this session's own
                    unpaid annual fee rides on `annualFee` (annualCarriedForward
                    records its share), while a prior session's is previousAnnualDues. */}
                {carriedAnnual > 0 && ` (includes Rs. ${carriedAnnual.toLocaleString()} carried forward)`}.
                Anything left unpaid carries to the next challan as annual fee dues.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
              <select {...register('paymentMethod')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option>Cash</option><option>Bank</option><option>Online</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
              <input {...register('remarks')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
            </div>
          </div>

          <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg text-sm">
            <span className="text-slate-500">Receiving Now:</span>
            <span className="font-bold text-emerald-700">Rs. {payingTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg text-sm">
            <span className="text-slate-500">Resulting Status:</span>
            <span className={`font-bold ${nextStatus === 'Paid' ? 'text-green-600' : nextStatus === 'Partial' ? 'text-amber-600' : 'text-red-600'}`}>{nextStatus}</span>
          </div>

          {canPayByMonth && settlesThrough && (
            <div className="text-xs bg-blue-50 border border-blue-100 text-blue-800 rounded-lg px-3 py-2">
              Settles through <strong>{settlesThrough}</strong>.
              {carriesFrom
                ? <> Remaining <strong>{carriesFrom} – {feeRecord.feeMonth}</strong> will carry to the next challan as dues.</>
                : <> This clears every month on this challan.</>}
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg">Cancel</button>
          <button type="submit" form="payment-form" disabled={isSubmitting || (payingTotal === 0 && newDiscount === 0)} className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg flex items-center gap-2 disabled:opacity-50">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}
