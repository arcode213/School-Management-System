import { useState, useEffect, useMemo } from 'react';
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
  // Blank means "use the amount from Fee Structures". It only holds a number once
  // the user deliberately types a different one for this batch.
  annualFee: '',
});

export default function GenerateFeeModal({ open, onClose, onSaved }) {
  const [classes, setClasses] = useState([]);
  const [structures, setStructures] = useState([]);
  const [formData, setFormData] = useState(blankForm());
  const [loading, setLoading] = useState(false);
  // Only true once the user overtypes the auto-detected amount for this batch.
  const [annualEdited, setAnnualEdited] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormData(blankForm());
    setAnnualEdited(false);
    getClasses().then(res => setClasses(res.data)).catch(()=>{});
    // Fee structures supply the per-class annual fee.
    getFeeStructures().then(res => setStructures(res.data || [])).catch(()=>{});
  }, [open]);

  // The annual fee configured for the selected class, read straight from Fee
  // Structures. DERIVED rather than copied into the form on class change: the
  // structures arrive from the server asynchronously, so a copy made when the class
  // was picked would be 0 whenever the user got there first, and the amount then had
  // to be typed by hand. Derived, it simply fills itself in the moment either the
  // class or the structures change.
  const structureAnnual = useMemo(() => {
    const struct = structures.find(s => s.className === formData.class);
    return Number(struct?.annualFee || 0);
  }, [structures, formData.class]);

  if (!open) return null;

  const handleClassChange = (className) => setFormData(f => ({ ...f, class: className }));

  // What this batch will charge: the typed amount if the user overrode it, otherwise
  // the class's configured annual fee.
  const annualAmount = annualEdited ? (Number(formData.annualFee) || 0) : structureAnnual;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { chargeAnnualFee, annualFee, ...rest } = formData;
      // Sending 0 for an un-edited amount deliberately leaves the resolution to the
      // server, which reads each student's own annual fee override (or their class
      // structure) individually — something this screen cannot do for a whole class
      // at once. An explicitly typed amount is sent and used as the batch default.
      const res = await addBulkFees({
        ...rest,
        chargeAnnualFee,
        annualFee: chargeAnnualFee && annualEdited ? annualAmount : 0,
      });
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
                  Adds a separate “Annual Fee” line to every challan in this batch. The amount is
                  taken from Fee Structures automatically.
                </span>
              </span>
            </label>

            {formData.chargeAnnualFee && (
              <div className="mt-3 pl-7 space-y-2">
                {/* The auto-detected amount, so the user can see what will be charged
                    without having to look it up or type it. */}
                {!annualEdited ? (
                  <div className="flex items-center justify-between gap-3 bg-white border border-indigo-200 rounded-lg px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                        Annual Fee {formData.class ? `— Class ${formData.class}` : ''}
                      </p>
                      <p className="text-lg font-bold text-indigo-700 leading-tight">
                        Rs. {structureAnnual.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {formData.class
                          ? 'From Fee Structures'
                          : 'Select a class to load its annual fee'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setAnnualEdited(true); setFormData(f => ({ ...f, annualFee: structureAnnual })); }}
                      className="flex-shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-600">Annual Fee Amount (Rs.)</label>
                      <button
                        type="button"
                        onClick={() => { setAnnualEdited(false); setFormData(f => ({ ...f, annualFee: '' })); }}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
                      >
                        Use Fee Structures
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={formData.annualFee}
                      onChange={e => setFormData({ ...formData, annualFee: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                      placeholder="e.g. 3000"
                    />
                  </div>
                )}

                {/* Only a warning when nothing is configured AND nothing was typed —
                    a per-student override can still supply an amount, so this cannot
                    block generating. */}
                {formData.class && !annualEdited && structureAnnual === 0 && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    No annual fee is set for Class {formData.class} in Fee Structures. Students with
                    their own annual fee override will still be charged theirs.
                  </p>
                )}

                <p className="text-[11px] text-slate-500">
                  A student with a custom annual fee is charged that instead. Charged once per
                  session — students already charged the annual fee (e.g. on an individual challan)
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
