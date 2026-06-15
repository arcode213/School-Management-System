import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateFee } from '../api/fees';

export default function FeePaymentModal({ open, onClose, feeRecord, onSaved }) {
  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm();
  
  const discount = Number(watch('discount') || 0);
  const paid = Number(watch('paidAmount') || 0);
  const totalDue = feeRecord ? (feeRecord.totalAmount - (feeRecord.discount || 0) - (feeRecord.paidAmount || 0)) : 0;
  
  // Predict new status
  const finalDiscount = (feeRecord?.discount || 0) + discount;
  const finalPaid = (feeRecord?.paidAmount || 0) + paid;
  const netPayable = feeRecord ? feeRecord.totalAmount - finalDiscount : 0;
  let nextStatus = 'Unpaid';
  if (finalPaid >= netPayable && netPayable > 0) nextStatus = 'Paid';
  else if (finalPaid > 0) nextStatus = 'Partial';

  useEffect(() => {
    if (open && feeRecord) {
      reset({ discount: 0, paidAmount: 0, paymentMethod: 'Cash', remarks: '' });
    }
  }, [open, feeRecord, reset]);

  const onSubmit = async (data) => {
    try {
      const payload = {
        discount: finalDiscount,
        paidAmount: finalPaid,
        status: nextStatus,
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
              <span className="text-slate-700">Rs. {((feeRecord.paidAmount || 0) + (feeRecord.discount || 0)).toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-red-600 mt-1 text-base">
              <span>Current Due:</span>
              <span>Rs. {totalDue.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">New Discount (Rs.)</label>
              <input type="number" max={totalDue} {...register('discount')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Paying Amount (Rs.)</label>
              <input type="number" max={totalDue - discount} {...register('paidAmount', { required: true })} className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2 text-sm focus:ring-emerald-500 font-bold text-emerald-700" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment Method</label>
              <select {...register('paymentMethod')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>Online</option>
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
        </form>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg">Cancel</button>
          <button type="submit" form="payment-form" disabled={isSubmitting || paid === 0} className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg flex items-center gap-2 disabled:opacity-50">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}
