import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateFee } from '../api/fees';
import { MONTHS, parseStartMonth, monthAt } from '../utils/feeMonths';

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

  const recurring = feeRecord ? (feeRecord.tuitionFee || 0) + (feeRecord.transportFee || 0) + (feeRecord.miscFee || 0) : 0;
  const rangeStart = feeRecord ? parseStartMonth(feeRecord.dueMonthRange, feeRecord.feeMonth) : '';
  const startIdx = MONTHS.indexOf(rangeStart);
  const feeIdx = feeRecord ? MONTHS.indexOf(feeRecord.feeMonth) : -1;
  let totalMonths = 1;
  if (startIdx >= 0 && feeIdx >= 0) { let s = feeIdx - startIdx; if (s < 0) s += 12; totalMonths = s + 1; }

  const monthlyTotal = feeRecord?.monthlyTotal ?? Math.max(0, (feeRecord?.totalAmount || 0) - (feeRecord?.annualTotal || 0));
  const monthlyAlreadyPaid = Math.max(0, monthlyTotal - monthlyDueRaw);
  const alreadyPaidMonths = recurring > 0 ? Math.min(totalMonths, Math.floor(monthlyAlreadyPaid / recurring)) : 0;
  const remainingMonths = Math.max(0, totalMonths - alreadyPaidMonths);
  const canPayByMonth = recurring > 0 && remainingMonths > 1;

  const monthlyPaidAfter = Math.min(Math.max(0, monthlyTotal - newDiscount), monthlyAlreadyPaid + monthlyPay);
  const monthsPaidAfter = recurring > 0 ? Math.min(totalMonths, Math.floor(monthlyPaidAfter / recurring)) : 0;
  const settlesThrough = monthsPaidAfter > 0 ? monthAt(startIdx + monthsPaidAfter - 1) : null;
  const carriesFrom = monthsPaidAfter < totalMonths ? monthAt(startIdx + monthsPaidAfter) : null;

  const selectMonths = (value) => {
    const n = Number(value);
    if (!n) return;
    const amt = n >= remainingMonths ? monthlyDue : Math.min(monthlyDue, recurring * n);
    setEdited(e => ({ ...e, monthly: true }));
    setValue('monthlyPay', amt, { shouldValidate: true });
  };

  const finalDiscount = (feeRecord?.discount || 0) + newDiscount;
  const finalPaid = (feeRecord?.amountPaid || 0) + payingTotal;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#080c14]/65 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111827] border border-white/5 rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh] text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-emerald-600 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <CreditCard className="text-white w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Record Fee Receipt</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={20} /></button>
        </div>

        <form id="payment-form" onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Summary Panel */}
          <div className="bg-white/3 rounded-2xl p-4 border border-white/5 flex flex-col gap-2.5">
            <div className="flex justify-between text-xs gap-3">
              <span className="text-slate-400">Student Name:</span>
              <span className="font-bold text-white text-right">
                {student.fullName || 'Student'} ({student.class ? `Class ${student.class}` : ''})
                {student.fatherName && (
                  <span className="block text-[10px] font-medium text-slate-500">s/o {student.fatherName}</span>
                )}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Fee Months:</span>
              <span className="font-bold text-white">{feeRecord.feeMonth} {feeRecord.feeYear}</span>
            </div>
            <div className="h-px bg-white/5 my-1" />
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Billed:</span>
              <span className="text-slate-300 font-semibold">Rs. {feeRecord.totalAmount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Prior Payments/Discount:</span>
              <span className="text-slate-300 font-semibold">Rs. {((feeRecord.amountPaid || 0) + (feeRecord.discount || 0)).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-500">Monthly Arrears Outstanding:</span>
              <span className="text-slate-400">Rs. {monthlyDue.toLocaleString()}</span>
            </div>
            {hasAnnual && (
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Annual Fee Outstanding:</span>
                <span className="text-indigo-400 font-semibold">Rs. {annualDue.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-rose-400 mt-1.5 text-base border-t border-white/5 pt-2">
              <span>Current Due Balance:</span>
              <span>Rs. {totalDue.toLocaleString()}</span>
            </div>
          </div>

          {canPayByMonth && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Installment Split (Number of Months)</label>
              <select onChange={e => selectMonths(e.target.value)} defaultValue=""
                className="w-full text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="" disabled className="bg-slate-900">Select months to pay…</option>
                {Array.from({ length: remainingMonths }, (_, i) => i + 1).map(n => {
                  const thru = monthAt(startIdx + alreadyPaidMonths + n - 1);
                  const isAll = n === remainingMonths;
                  return (
                    <option key={n} value={n} className="bg-slate-900">
                      {n} Month{n > 1 ? 's' : ''} — settles through {thru}{isAll ? ' (clears months)' : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-[10px] text-slate-500 mt-1.5 font-medium leading-relaxed">
                Tuition/recurring cost: Rs. {recurring.toLocaleString()} / month. This auto-fills the payment fields.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">New Discount (Rs.)</label>
              <input type="number" min="0" max={monthlyDueRaw} {...register('discount')}
                className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                {hasAnnual ? 'Monthly Cash Paid (Rs.)' : 'Cash Received (Rs.)'}
              </label>
              <input
                type="number" min="0" max={monthlyDue}
                {...register('monthlyPay', {
                  onChange: () => setEdited(e => ({ ...e, monthly: true })),
                })}
                className="w-full text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              />
            </div>
          </div>

          {hasAnnual && (
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Annual Fee Cash (Rs.)</label>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => { setEdited(e => ({ ...e, annual: true })); setValue('annualPay', annualDue); }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider">Pay Full</button>
                  <button type="button"
                    onClick={() => { setEdited(e => ({ ...e, annual: true })); setValue('annualPay', 0); }}
                    className="text-[10px] text-slate-500 hover:text-slate-400 font-bold uppercase tracking-wider">Skip</button>
                </div>
              </div>
              <input
                type="number" min="0" max={annualDue}
                {...register('annualPay', {
                  onChange: () => setEdited(e => ({ ...e, annual: true })),
                })}
                className="w-full text-xs bg-indigo-950 border border-indigo-500/30 rounded-xl px-3 py-2.5 text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
              />
              <p className="text-[10px] text-slate-500 leading-normal font-medium">
                Unpaid annual balance Rs. {annualDue.toLocaleString()}
                {carriedAnnual > 0 && ` (includes Rs. ${carriedAnnual.toLocaleString()} forward dues)`}.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Payment Method</label>
              <select {...register('paymentMethod')} className="w-full text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                <option value="Cash" className="bg-slate-900">Cash</option>
                <option value="Bank" className="bg-slate-900">Bank Deposit</option>
                <option value="Online" className="bg-slate-900">Online Transfer</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Remarks / Details</label>
              <input {...register('remarks')} className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Challan slip no." />
            </div>
          </div>

          <div className="flex justify-between items-center bg-white/3 border border-white/5 px-4 py-2.5 rounded-xl text-xs">
            <span className="text-slate-400">Total Receipt Value:</span>
            <span className="font-bold text-emerald-400">Rs. {payingTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center bg-white/3 border border-white/5 px-4 py-2.5 rounded-xl text-xs">
            <span className="text-slate-400">Resulting Account Status:</span>
            <span className={`font-bold ${nextStatus === 'Paid' ? 'text-emerald-400' : nextStatus === 'Partial' ? 'text-amber-400' : 'text-rose-400'}`}>{nextStatus}</span>
          </div>

          {canPayByMonth && settlesThrough && (
            <div className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl px-3.5 py-2.5 leading-relaxed font-semibold">
              Settles through <strong>{settlesThrough}</strong>.
              {carriesFrom
                ? <> Remaining <strong>{carriesFrom} – {feeRecord.feeMonth}</strong> will carry to the next challan as outstanding dues.</>
                : <> This clears all monthly splits on this challan.</>}
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-3 bg-white/3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/5 rounded-xl transition">Cancel</button>
          <button type="submit" form="payment-form" disabled={isSubmitting || (payingTotal === 0 && newDiscount === 0)} className="px-5 py-2.5 bg-gradient-to-tr from-emerald-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}
