import { useForm } from 'react-hook-form';
import { X, Loader2, CopyPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { addBulkFees } from '../api/fees';

const CLASSES = ['Nursery','KG','1','2','3','4','5','6','7','8','9','10','11','12'];
const SECTIONS = ['A','B','C','D','E'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function BulkFeeModal({ open, onClose, onSaved }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: {
      feeMonth: MONTHS[new Date().getMonth()],
      feeYear: new Date().getFullYear(),
      tuitionFee: 0,
      examFee: 0,
      transportFee: 0,
      otherFee: 0
    }
  });

  const onSubmit = async (data) => {
    try {
      const res = await addBulkFees(data);
      toast.success(res.data.message || 'Bulk fees generated successfully');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate bulk fees');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <CopyPlus className="text-white w-4 h-4" />
            </div>
            <h2 className="font-semibold text-slate-800">Generate Bulk Fees</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form id="bulk-fee-form" onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-5">
          <p className="text-sm text-slate-500 mb-2">
            This will generate unpaid fee records for all active students in the selected class.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Class *</label>
              <select {...register('class', { required: true })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Select class</option>
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Section (Optional)</label>
              <select {...register('section')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                <option value="">All Sections</option>
                {SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fee Month *</label>
              <select {...register('feeMonth')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fee Year *</label>
              <input type="number" {...register('feeYear')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Fee Breakdown (Rs.)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tuition Fee</label>
                <input type="number" {...register('tuitionFee')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Exam Fee</label>
                <input type="number" {...register('examFee')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Transport Fee</label>
                <input type="number" {...register('transportFee')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Other Fee</label>
                <input type="number" {...register('otherFee')} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg">Cancel</button>
          <button type="submit" form="bulk-fee-form" disabled={isSubmitting} className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center gap-2">
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Generate Fees
          </button>
        </div>
      </div>
    </div>
  );
}
