import { useState, useEffect } from 'react';
import { addBulkFees } from '../api/fees';
import { getClasses } from '../api/students';
import toast from 'react-hot-toast';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function GenerateFeeModal({ open, onClose, onSaved }) {
  const [classes, setClasses] = useState([]);
  const [formData, setFormData] = useState({
    class: '',
    section: '',
    feeMonth: MONTHS[new Date().getMonth()],
    feeYear: new Date().getFullYear(),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      getClasses().then(res => setClasses(res.data)).catch(()=>{});
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addBulkFees(formData);
      toast.success('Fees generated successfully!');
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
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Class</label>
              <select required value={formData.class} onChange={e => setFormData({...formData, class: e.target.value})} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50">
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
