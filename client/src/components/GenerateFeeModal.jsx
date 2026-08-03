import { useState, useEffect } from 'react';
import { addBulkFees, getFeeStructures } from '../api/fees';
import { getClasses } from '../api/students';
import toast from 'react-hot-toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const blankForm = () => ({
  class: '',
  section: '',
  feeMonth: MONTHS[new Date().getMonth()],
  feeYear: new Date().getFullYear(),
  dueDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0],
  // Annual fee is opt-in: nothing is charged unless the box is ticked.
  chargeAnnualFee: false,
  annualFee: 0,
});

export default function GenerateFeeModal({ open, onClose, onSaved }) {
  const [classes, setClasses] = useState([]);
  const [structures, setStructures] = useState([]);
  const [formData, setFormData] = useState(blankForm());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormData(blankForm());
    getClasses().then(res => setClasses(res.data)).catch(()=>{});
    // Fee structures supply the per-class default annual fee.
    getFeeStructures().then(res => setStructures(res.data || [])).catch(()=>{});
  }, [open]);

  if (!open) return null;

  // Picking a class pre-fills that class's annual fee (still fully editable).
  const handleClassChange = (className) => {
    const struct = structures.find(s => s.className === className);
    setFormData(f => ({ ...f, class: className, annualFee: struct?.annualFee ?? f.annualFee }));
  };

  const annualAmount = Number(formData.annualFee) || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { chargeAnnualFee, annualFee, ...rest } = formData;
      const res = await addBulkFees({ ...rest, annualFee: chargeAnnualFee ? annualAmount : 0 });
      // The server reports what it skipped (Freeship, existing challans, students
      // already charged the annual fee). Show that instead of a generic success.
      toast.success(res.data?.message || 'Fees generated successfully!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error generating fees');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Generate Monthly Fees</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-500 mb-4 bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100">
            This will generate a consolidated challan for the selected class. It automatically applies Class Fee Structures and individual Student Overrides, and safely rolls over previous unpaid dues.
            <strong className="block mt-1.5">Freeship students are skipped — no challan is created for them.</strong>
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
              <select required value={formData.class} onChange={e => handleClassChange(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50">
                <option value="">Select Class</option>
                {classes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Section (Optional)</label>
              <input type="text" value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50" placeholder="e.g. A" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fee Month</label>
              <select required value={formData.feeMonth} onChange={e => setFormData({...formData, feeMonth: e.target.value})} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50">
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fee Year</label>
              <input type="number" required value={formData.feeYear} onChange={e => setFormData({...formData, feeYear: e.target.value})} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
            <input type="date" required value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50" />
          </div>

          {/* Annual fee — opt in for any month's batch */}
          <div className={`rounded-lg border px-3 py-3 transition ${formData.chargeAnnualFee ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
            <label htmlFor="gen-chargeAnnual" className="flex items-start gap-2.5 cursor-pointer">
              <input
                id="gen-chargeAnnual"
                type="checkbox"
                checked={formData.chargeAnnualFee}
                onChange={e => setFormData({ ...formData, chargeAnnualFee: e.target.checked })}
                className="mt-0.5 flex-shrink-0"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">Also charge the annual fee this month</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Adds a separate “Annual Fee” line to every challan in this batch.
                </span>
              </span>
            </label>

            {formData.chargeAnnualFee && (
              <div className="mt-3 pl-7">
                <label className="block text-xs font-medium text-slate-600 mb-1">Annual Fee Amount (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.annualFee}
                  onChange={e => setFormData({ ...formData, annualFee: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                  placeholder="e.g. 3000"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Pre-filled from the selected class's Fee Structure. Charged once per session —
                  students who were already charged the annual fee (e.g. on an individual challan)
                  are not charged again; anything they still owe on it carries forward as usual.
                </p>
              </div>
            )}
          </div>
          <div className="pt-4 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm disabled:opacity-50">
              {loading ? 'Generating...' : 'Generate Challans'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
