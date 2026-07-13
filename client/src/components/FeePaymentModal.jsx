import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateFee } from '../api/fees';
import { MONTHS, parseStartMonth, monthAt } from '../utils/feeMonths';

export default function FeePaymentModal({ open, onClose, feeRecord, onSaved }) {
  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm();

  const newDiscount = Number(watch('discount') || 0);
  const paid = Number(watch('amountPaid') || 0);
  // balance is the authoritative outstanding amount (totalAmount - amountPaid), kept by the pre-save hook.
  const totalDue = feeRecord ? (feeRecord.balance ?? 0) : 0;

  // ─── Month-based payment helper ──────────────────────────────────
  // A multi-month challan (e.g. "April - June") can be paid a few months at a
  // time. The recurring monthly rate is tuition + transport + misc.
  const recurring = feeRecord ? (feeRecord.tuitionFee || 0) + (feeRecord.transportFee || 0) + (feeRecord.miscFee || 0) : 0;
  const rangeStart = feeRecord ? parseStartMonth(feeRecord.dueMonthRange, feeRecord.feeMonth) : '';
  const startIdx = MONTHS.indexOf(rangeStart);
  const feeIdx = feeRecord ? MONTHS.indexOf(feeRecord.feeMonth) : -1;
  let totalMonths = 1;
  if (startIdx >= 0 && feeIdx >= 0) { let s = feeIdx - startIdx; if (s < 0) s += 12; totalMonths = s + 1; }
  const alreadyPaidMonths = recurring > 0 ? Math.min(totalMonths, Math.floor((feeRecord?.amountPaid || 0) / recurring)) : 0;
  const remainingMonths = Math.max(0, totalMonths - alreadyPaidMonths);
  const canPayByMonth = recurring > 0 && remainingMonths > 1;

  // Live preview of what will be settled and what carries forward. Based on the
  // challan's TOTAL paid-after-this-payment so it matches the server exactly.
  const finalPaidTotal = (feeRecord?.amountPaid || 0) + paid;
  const monthsPaidAfter = recurring > 0 ? Math.min(totalMonths, Math.floor(finalPaidTotal / recurring)) : 0;
  const settlesThrough = monthsPaidAfter > 0 ? monthAt(startIdx + monthsPaidAfter - 1) : null;
  const carriesFrom = monthsPaidAfter < totalMonths ? monthAt(startIdx + monthsPaidAfter) : null;

  // Picking N months fills in the paying amount (still editable afterwards).
  const selectMonths = (value) => {
    const n = Number(value);
    if (!n) return;
    const amt = n >= remainingMonths ? totalDue : Math.min(totalDue, recurring * n);
    setValue('amountPaid', amt, { shouldValidate: true });
  };

  // Predict new status (mirrors the server pre-save recalculation).
  // The server recomputes totalAmount as (charges + lateFine + previousDues) - discount,
  // so applying an additional discount reduces the new total by exactly that amount.
  const finalDiscount = (feeRecord?.discount || 0) + newDiscount;
  const finalPaid = (feeRecord?.amountPaid || 0) + paid;
  const netPayable = feeRecord ? feeRecord.totalAmount - newDiscount : 0;
  let nextStatus = 'Unpaid';
  if (finalPaid >= netPayable && netPayable > 0) nextStatus = 'Paid';
  else if (finalPaid > 0) nextStatus = 'Partial';

  useEffect(() => {
    if (open && feeRecord) {
      reset({ discount: 0, amountPaid: 0, paymentMethod: 'Cash', remarks: '' });
    }
  }, [open, feeRecord, reset]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        discount: finalDiscount,
        amountPaid: finalPaid,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
              <CreditCard className="text-white w-4 h-4" />
            </div>
            <h2 className="font-semibold text-slate-800">Record Payment</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form id="payment-form" onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Student:</span>
              <span className="font-semibold text-slate-800">{feeRecord.studentInfo?.fullName || 'Student'} ({feeRecord.studentInfo?.class || ''})</span>
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
                      {n} month{n > 1 ? 's' : ''} — through {thru}{isAll ? ' (clears challan)' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Monthly fee Rs. {recurring.toLocaleString()} — this fills the paying amount for you; you can still edit it.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">New Discount (Rs.)</label>
              <input type="number" max={totalDue} {...register('discount')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Paying Amount (Rs.)</label>
              <input type="number" max={totalDue - newDiscount} {...register('amountPaid', { required: true })} className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 font-bold text-emerald-700" />
            </div>
          </div>

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
            <span className="text-slate-500">Resulting Status:</span>
            <span className={`font-bold ${nextStatus === 'Paid' ? 'text-green-600' : nextStatus === 'Partial' ? 'text-amber-600' : 'text-red-600'}`}>{nextStatus}</span>
          </div>

          {canPayByMonth && settlesThrough && (
            <div className="text-xs bg-blue-50 border border-blue-100 text-blue-800 rounded-lg px-3 py-2">
              Settles through <strong>{settlesThrough}</strong>.
              {carriesFrom
                ? <> Remaining <strong>{carriesFrom} – {feeRecord.feeMonth}</strong> will carry to the next challan as dues.</>
                : <> This clears the full challan.</>}
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg">Cancel</button>
          <button type="submit" form="payment-form" disabled={isSubmitting || (paid === 0 && newDiscount === 0)} className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg flex items-center gap-2 disabled:opacity-50">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}
