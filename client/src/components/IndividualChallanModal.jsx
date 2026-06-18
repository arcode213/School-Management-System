import { useState, useEffect, useCallback } from 'react';
import { addFee, updateFee } from '../api/fees';
import { getStudents } from '../api/students';
import toast from 'react-hot-toast';
import { X, Search, Loader2, FileText } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const blankForm = () => ({
  feeMonth: MONTHS[new Date().getMonth()],
  feeYear: new Date().getFullYear(),
  dueDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0],
  tuitionFee: 0,
  examFee: 0,
  transportFee: 0,
  miscFee: 0,
  previousDues: 0,
});

// Dual-purpose modal: create an individual challan (with student search) or
// edit an existing challan's charges (feeRecord supplied).
export default function IndividualChallanModal({ open, onClose, onSaved, feeRecord }) {
  const isEdit = Boolean(feeRecord);

  const [form, setForm] = useState(blankForm());
  const [loading, setLoading] = useState(false);

  // Student selection (create mode only)
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setForm({
        feeMonth: feeRecord.feeMonth,
        feeYear: feeRecord.feeYear,
        dueDate: feeRecord.dueDate ? feeRecord.dueDate.substring(0, 10) : blankForm().dueDate,
        tuitionFee: feeRecord.tuitionFee || 0,
        examFee: feeRecord.examFee || 0,
        transportFee: feeRecord.transportFee || 0,
        miscFee: feeRecord.miscFee || 0,
        previousDues: feeRecord.previousDues || 0,
      });
      setSelectedStudent({
        _id: feeRecord.student?._id || feeRecord.student,
        fullName: feeRecord.studentInfo?.fullName || feeRecord.student?.fullName,
        class: feeRecord.studentInfo?.class,
        section: feeRecord.studentInfo?.section,
      });
    } else {
      setForm(blankForm());
      setSelectedStudent(null);
      setQuery('');
      setResults([]);
    }
  }, [open, feeRecord, isEdit]);

  // Debounced student search
  const runSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { data } = await getStudents({ search: q, status: 'Active', limit: 8 });
      setResults(data.students);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (isEdit || !open) return;
    const t = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(t);
  }, [query, isEdit, open, runSearch]);

  if (!open) return null;

  const setNum = (key, v) => setForm(f => ({ ...f, [key]: v === '' ? '' : Number(v) }));

  const currentTotal =
    (Number(form.tuitionFee) || 0) + (Number(form.examFee) || 0) +
    (Number(form.transportFee) || 0) + (Number(form.miscFee) || 0) +
    (isEdit ? (Number(form.previousDues) || 0) : 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !selectedStudent) {
      toast.error('Please select a student');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await updateFee(feeRecord._id, {
          feeMonth: form.feeMonth,
          feeYear: form.feeYear,
          dueDate: form.dueDate,
          tuitionFee: Number(form.tuitionFee) || 0,
          examFee: Number(form.examFee) || 0,
          transportFee: Number(form.transportFee) || 0,
          miscFee: Number(form.miscFee) || 0,
          previousDues: Number(form.previousDues) || 0,
        });
        toast.success('Challan updated successfully');
      } else {
        await addFee({
          student: selectedStudent._id,
          studentAcademicRecord: selectedStudent.academicRecordId,
          feeMonth: form.feeMonth,
          feeYear: form.feeYear,
          dueDate: form.dueDate,
          tuitionFee: Number(form.tuitionFee) || 0,
          examFee: Number(form.examFee) || 0,
          transportFee: Number(form.transportFee) || 0,
          miscFee: Number(form.miscFee) || 0,
        });
        toast.success('Challan generated successfully');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save challan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <FileText className="text-white w-4 h-4" />
            </div>
            <h2 className="font-semibold text-slate-800">{isEdit ? `Edit Challan ${feeRecord.challanNo}` : 'Generate Individual Challan'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Student selector */}
          {isEdit ? (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-sm">
              <span className="text-slate-500">Student: </span>
              <span className="font-semibold text-slate-800">
                {selectedStudent?.fullName} {selectedStudent?.class ? `(Class ${selectedStudent.class}${selectedStudent.section ? ' ' + selectedStudent.section : ''})` : ''}
              </span>
            </div>
          ) : selectedStudent ? (
            <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-sm flex items-center justify-between">
              <div>
                <span className="text-slate-500">Student: </span>
                <span className="font-semibold text-slate-800">
                  {selectedStudent.fullName} (Class {selectedStudent.class}{selectedStudent.section ? ' ' + selectedStudent.section : ''})
                </span>
              </div>
              <button type="button" onClick={() => setSelectedStudent(null)} className="text-xs text-blue-600 hover:underline">Change</button>
            </div>
          ) : (
            <div className="relative">
              <label className="block text-xs font-medium text-slate-600 mb-1">Find Student</label>
              <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-slate-50">
                <Search size={16} className="text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name, ID, father, roll..."
                  className="bg-transparent outline-none w-full text-sm"
                />
                {searching && <Loader2 size={14} className="animate-spin text-slate-400" />}
              </div>
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {results.map(s => (
                    <button
                      key={s.academicRecordId || s._id}
                      type="button"
                      onClick={() => { setSelectedStudent(s); setResults([]); setQuery(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0"
                    >
                      <div className="font-medium text-slate-800">{s.fullName}</div>
                      <div className="text-xs text-slate-500">{s.studentId} • Class {s.class}{s.section ? ' ' + s.section : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fee Month</label>
              <select value={form.feeMonth} onChange={e => setForm({ ...form, feeMonth: e.target.value })} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50">
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fee Year</label>
              <input type="number" value={form.feeYear} onChange={e => setNum('feeYear', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tuition Fee</label>
              <input type="number" value={form.tuitionFee} onChange={e => setNum('tuitionFee', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Transport Fee</label>
              <input type="number" value={form.transportFee} onChange={e => setNum('transportFee', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Exam Fee</label>
              <input type="number" value={form.examFee} onChange={e => setNum('examFee', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Misc Fee</label>
              <input type="number" value={form.miscFee} onChange={e => setNum('miscFee', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50" />
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Previous Dues</label>
              <input type="number" value={form.previousDues} onChange={e => setNum('previousDues', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
            <input type="date" required value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full text-sm border rounded-lg px-3 py-2 bg-slate-50" />
          </div>

          <div className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg text-sm">
            <span className="text-slate-500">{isEdit ? 'New Total Amount' : 'Current Charges'}:</span>
            <span className="font-bold text-slate-800">Rs. {currentTotal.toLocaleString()}</span>
          </div>
          {!isEdit && (
            <p className="text-xs text-slate-400">Any unpaid previous dues for this student are automatically rolled into the new challan.</p>
          )}

          <div className="pt-2 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm disabled:opacity-50 flex items-center gap-2">
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Update Challan' : 'Generate Challan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
