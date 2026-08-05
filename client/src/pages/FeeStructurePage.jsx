import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { getFeeStructures, saveFeeStructure, getFeeOverrides, saveFeeOverride, deleteFeeOverride, rolloverFeeStructure } from '../api/fees';
import { getStudents } from '../api/students';
import toast from 'react-hot-toast';
import { Settings, Plus, Edit, Trash2, ArrowRightLeft, Landmark, Users, Search, Loader2, X } from 'lucide-react';
import { CLASSES } from '../utils/constants';

export default function FeeStructurePage() {
  const { user } = useAuth();
  const { sessions, currentSession, currentCampus } = useAppContext();
  const [structures, setStructures] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [activeTab, setActiveTab] = useState('class');
  
  // Modals
  const [showStructModal, setShowStructModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showRolloverModal, setShowRolloverModal] = useState(false);

  // Form states
  const [structForm, setStructForm] = useState({ className: 'Nursery', tuitionFee: 0, admissionFee: 0, examFee: 0, transportFee: 0, miscFee: 0, annualFee: 0 });
  const [overrideForm, setOverrideForm] = useState({ student: '', customTuitionFee: '', customTransportFee: '', customMiscFee: '', customAnnualFee: '', reason: '' });
  const [rolloverForm, setRolloverForm] = useState({ sourceSessionId: '', targetSessionId: '', incrementAmount: 200 });

  // Student picker for the override modal. Searched on the server rather than held
  // in a dropdown: the list used to be one 1000-record fetch on every page load, which
  // both truncated silently once a school passed a thousand students and made picking
  // one a scroll through every name in the school.
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [overrideStudent, setOverrideStudent] = useState(null);
  // Set when an existing override is opened — the student is then fixed, since the
  // override is keyed by student and changing it would silently target someone else.
  const [editingOverride, setEditingOverride] = useState(false);

  useEffect(() => {
    if (currentCampus && currentSession) fetchData();
  }, [currentCampus, currentSession]);

  const fetchData = async () => {
    try {
      const [strRes, ovrRes] = await Promise.all([
        getFeeStructures(),
        getFeeOverrides(),
      ]);
      setStructures(strRes.data);
      setOverrides(ovrRes.data);
    } catch (err) {
      toast.error('Failed to load fee structures');
    }
  };

  const runStudentSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setStudentResults([]); return; }
    setSearchingStudents(true);
    try {
      const { data } = await getStudents({ search: q.trim(), status: 'Active', limit: 8 });
      setStudentResults(data.students || []);
    } catch {
      setStudentResults([]);
    } finally {
      setSearchingStudents(false);
    }
  }, []);

  // Debounced so typing a name does not fire a request per keystroke.
  useEffect(() => {
    if (!showOverrideModal || overrideStudent) return;
    const t = setTimeout(() => runStudentSearch(studentQuery), 350);
    return () => clearTimeout(t);
  }, [studentQuery, showOverrideModal, overrideStudent, runStudentSearch]);

  const handleStructSubmit = async (e) => {
    e.preventDefault();
    try {
      await saveFeeStructure(structForm);
      toast.success('Fee structure saved!');
      setShowStructModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving structure');
    }
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    // The picker replaced a `required` select, so the student is validated here.
    if (!overrideForm.student) {
      toast.error('Search for and select a student first');
      return;
    }
    try {
      await saveFeeOverride(overrideForm);
      toast.success('Override saved!');
      setShowOverrideModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving override');
    }
  };

  const handleRolloverSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await rolloverFeeStructure(rolloverForm);
      toast.success(res.data.message || 'Fees carried forward successfully!');
      setShowRolloverModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error during fee rollover');
    }
  };

  const handleDeleteOverride = async (id) => {
    if (!window.confirm('Delete this override?')) return;
    try {
      await deleteFeeOverride(id);
      toast.success('Override deleted');
      fetchData();
    } catch (err) {
      toast.error('Error deleting');
    }
  };

  const openStructModal = (st = null) => {
    if (st) {
      setStructForm({
        className: st.className,
        tuitionFee: st.tuitionFee,
        admissionFee: st.admissionFee,
        examFee: st.examFee,
        transportFee: st.transportFee,
        miscFee: st.miscFee,
        annualFee: st.annualFee || 0
      });
    } else {
      setStructForm({ className: 'Nursery', tuitionFee: 0, admissionFee: 0, examFee: 0, transportFee: 0, miscFee: 0, annualFee: 0 });
    }
    setShowStructModal(true);
  };

  // An override is only "set" when it holds a real number. 0 is a genuine override —
  // a fee the school has excused — so it must not be shown as "no override".
  const fmtOverride = (value) =>
    value === undefined || value === null ? '—' : `Rs ${Number(value).toLocaleString()}`;

  // Opening an existing override loads it for editing. Blank inputs stay blank rather
  // than becoming 0, so "not overridden" survives a round trip through the form.
  const openOverrideModal = (o = null) => {
    const val = (v) => (v === undefined || v === null ? '' : v);
    setOverrideForm(o ? {
      student: o.student?._id || o.student || '',
      customTuitionFee: val(o.customTuitionFee),
      customTransportFee: val(o.customTransportFee),
      customMiscFee: val(o.customMiscFee),
      customAnnualFee: val(o.customAnnualFee),
      reason: o.reason || '',
    } : { student: '', customTuitionFee: '', customTransportFee: '', customMiscFee: '', customAnnualFee: '', reason: '' });

    setOverrideStudent(o?.student?._id ? o.student : null);
    setEditingOverride(!!o);
    setStudentQuery('');
    setStudentResults([]);
    setShowOverrideModal(true);
  };

  const selectOverrideStudent = (student) => {
    setOverrideStudent(student);
    setOverrideForm(f => ({ ...f, student: student._id }));
    setStudentQuery('');
    setStudentResults([]);
  };

  const clearOverrideStudent = () => {
    setOverrideStudent(null);
    setOverrideForm(f => ({ ...f, student: '' }));
    setStudentQuery('');
    setStudentResults([]);
  };

  // Students who already have an override, so the picker can flag that choosing them
  // will edit what is there rather than silently replacing it.
  const overriddenStudentIds = new Set(overrides.map(o => String(o.student?._id || o.student)));

  const openRolloverModal = () => {
    const sorted = [...sessions].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const currentIdx = sorted.findIndex(s => s._id === currentSession);
    const source = currentSession || (sorted[0]?._id || '');
    const target = (currentIdx !== -1 && sorted[currentIdx + 1]?._id) || '';
    
    setRolloverForm({
      sourceSessionId: source,
      targetSessionId: target,
      incrementAmount: 200
    });
    setShowRolloverModal(true);
  };

  // Screen Analytics Calculations
  const averageTuition = structures.length > 0 
    ? Math.round(structures.reduce((sum, s) => sum + (s.tuitionFee || 0), 0) / structures.length)
    : 0;
  
  const overridesCount = overrides.length;
  
  const highestTuition = structures.length > 0
    ? [...structures].sort((a,b) => b.tuitionFee - a.tuitionFee)[0]
    : null;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase flex items-center gap-2">
            <Settings className="text-blue-500" /> Fee Settings
          </h1>
          <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-wider">Configure class structures and student adjustments</p>
        </div>
        <div className="flex items-center gap-2.5">
          {user?.role !== 'Staff' && (
            <button onClick={openRolloverModal} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl px-4 py-2.5 transition">
              <ArrowRightLeft size={14} /> Carry/Rollover Fees
            </button>
          )}
          {activeTab === 'class' ? (
            <button onClick={() => openStructModal()} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl px-4 py-2.5 transition shadow-lg shadow-blue-500/25 active:scale-95">
              <Plus size={14} /> Set Class Fee
            </button>
          ) : (
            <button onClick={() => openOverrideModal()} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl px-4 py-2.5 transition shadow-lg shadow-purple-500/25 active:scale-95">
              <Plus size={14} /> Add Override
            </button>
          )}
        </div>
      </div>

      {/* Screen Analytics Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Landmark className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Average Monthly Tuition</p>
            <p className="text-2xl font-extrabold text-blue-400 mt-0.5 tracking-tight">Rs. {averageTuition.toLocaleString()}</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Class-wise standard mean rate</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Users className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Custom Overrides</p>
            <p className="text-2xl font-extrabold text-purple-400 mt-0.5 tracking-tight">{overridesCount} accounts</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Students with override adjustments</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-amber-600/80 to-amber-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Settings className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Highest Tuition Rate</p>
            <p className="text-2xl font-extrabold text-amber-400 mt-0.5 tracking-tight">
              {highestTuition ? `Rs. ${highestTuition.tuitionFee.toLocaleString()}` : '—'}
            </p>
            <p className="text-slate-500 text-xs mt-1 font-medium truncate">
              {highestTuition ? `Applied on Class ${highestTuition.className}` : 'No class limits registered'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/5">
        <button
          className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'class' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-slate-400 hover:text-slate-200'}`}
          onClick={() => setActiveTab('class')}
        >
          Class Fee Structures
        </button>
        <button
          className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'override' ? 'border-b-2 border-purple-500 text-purple-400' : 'text-slate-400 hover:text-slate-200'}`}
          onClick={() => setActiveTab('override')}
        >
          Student Fee Overrides
        </button>
      </div>

      {/* Table grids */}
      {activeTab === 'class' && (
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/3 border-b border-white/5 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-4">Class</th>
                  <th className="p-4">Tuition Fee</th>
                  <th className="p-4">Admission Fee</th>
                  <th className="p-4">Exam Fee</th>
                  <th className="p-4">Transport Fee</th>
                  <th className="p-4">Misc Fee</th>
                  <th className="p-4">Annual Fee</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3 text-slate-300">
                {structures.map(s => (
                  <tr key={s._id} className="hover:bg-white/3 transition">
                    <td className="p-4 font-bold text-white">Class {s.className}</td>
                    <td className="p-4 font-semibold">Rs {s.tuitionFee?.toLocaleString()}</td>
                    <td className="p-4">Rs {s.admissionFee?.toLocaleString()}</td>
                    <td className="p-4">Rs {s.examFee?.toLocaleString()}</td>
                    <td className="p-4">Rs {s.transportFee?.toLocaleString()}</td>
                    <td className="p-4">Rs {s.miscFee?.toLocaleString()}</td>
                    <td className="p-4 font-bold text-indigo-400">Rs {(s.annualFee || 0).toLocaleString()}</td>
                    <td className="p-4">
                      <button onClick={() => openStructModal(s)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 rounded-xl transition"><Edit size={14} /></button>
                    </td>
                  </tr>
                ))}
                {structures.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-12 text-center text-slate-500 font-medium">No class fee structures defined yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'override' && (
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/3 border-b border-white/5 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-4">Student</th>
                  <th className="p-4">Custom Tuition</th>
                  <th className="p-4">Custom Transport</th>
                  <th className="p-4">Custom Misc</th>
                  <th className="p-4">Custom Annual</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3 text-slate-300">
                {overrides.map(o => (
                  <tr key={o._id} className="hover:bg-white/3 transition">
                    <td className="p-4">
                      <p className="font-bold text-white">{o.student?.fullName}</p>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">{o.student?.studentId}</p>
                    </td>
                    <td className="p-4 font-bold text-purple-400">{fmtOverride(o.customTuitionFee)}</td>
                    <td className="p-4 font-semibold text-slate-300">{fmtOverride(o.customTransportFee)}</td>
                    <td className="p-4 font-semibold text-slate-300">{fmtOverride(o.customMiscFee)}</td>
                    <td className="p-4 font-bold text-indigo-400">{fmtOverride(o.customAnnualFee)}</td>
                    <td className="p-4 text-slate-400">{o.reason || '—'}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openOverrideModal(o)} className="p-2 text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 rounded-xl transition" title="Edit override"><Edit size={14} /></button>
                        {user?.role !== 'Staff' && (
                          <button onClick={() => handleDeleteOverride(o._id)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition" title="Delete override"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {overrides.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-12 text-center text-slate-500 font-medium">No student overrides defined yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showStructModal && (
        <div className="fixed inset-0 bg-[#080c14]/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-white/5 rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold uppercase tracking-wider text-white mb-4">Set Class Fee Structure</h2>
            <form onSubmit={handleStructSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Class</label>
                <select className="w-full text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-blue-500" value={structForm.className} onChange={e=>setStructForm({...structForm, className: e.target.value})} required>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tuition Fee</label><input type="number" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" value={structForm.tuitionFee} onChange={e=>setStructForm({...structForm, tuitionFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Transport Fee</label><input type="number" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" value={structForm.transportFee} onChange={e=>setStructForm({...structForm, transportFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Admission Fee</label><input type="number" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" value={structForm.admissionFee} onChange={e=>setStructForm({...structForm, admissionFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Exam Fee</label><input type="number" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" value={structForm.examFee} onChange={e=>setStructForm({...structForm, examFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Misc Fee</label><input type="number" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" value={structForm.miscFee} onChange={e=>setStructForm({...structForm, miscFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Annual Fee</label><input type="number" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" value={structForm.annualFee} onChange={e=>setStructForm({...structForm, annualFee: e.target.value})} /></div>
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowStructModal(false)} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/5 rounded-xl transition">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-blue-500/25">Save Structure</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOverrideModal && (
        <div className="fixed inset-0 bg-[#080c14]/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-white/5 rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold uppercase tracking-wider text-white mb-1">
              {editingOverride ? 'Edit Student Override' : 'Add Student Override'}
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Set only the fees that differ for this student. Leave a box <strong>empty</strong> to use
              the class fee structure; enter <strong>0</strong> to excuse that fee entirely.
            </p>
            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Student</label>

                {overrideStudent ? (
                  <div className="flex items-center justify-between gap-3 bg-slate-900 border border-purple-500/30 rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{overrideStudent.fullName}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                        <span className="font-mono">{overrideStudent.studentId}</span>
                        {overrideStudent.class ? ` • Class ${overrideStudent.class}${overrideStudent.section ? ' ' + overrideStudent.section : ''}` : ''}
                        {overrideStudent.fatherName ? ` • s/o ${overrideStudent.fatherName}` : ''}
                      </p>
                    </div>
                    {/* Editing an existing override keeps the student fixed — it is what
                        the record is keyed by. */}
                    {!editingOverride && (
                      <button type="button" onClick={clearOverrideStudent}
                        className="flex-shrink-0 text-slate-500 hover:text-rose-400 transition" title="Choose a different student">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center gap-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-purple-500">
                      <Search size={14} className="text-slate-500 flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={studentQuery}
                        onChange={e => setStudentQuery(e.target.value)}
                        placeholder="Search by name, ID, father or roll no..."
                        className="bg-transparent outline-none w-full text-xs text-white placeholder-slate-600 font-medium"
                      />
                      {searchingStudents && <Loader2 size={13} className="animate-spin text-slate-500 flex-shrink-0" />}
                    </div>

                    {studentResults.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-[#111827] border border-white/10 rounded-xl shadow-2xl max-h-56 overflow-y-auto">
                        {studentResults.map(s => (
                          <button
                            key={s.academicRecordId || s._id}
                            type="button"
                            onClick={() => selectOverrideStudent(s)}
                            className="w-full text-left px-3 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-0 transition"
                          >
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                              {s.fullName}
                              {overriddenStudentIds.has(String(s._id)) && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                  Has override
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              <span className="font-mono">{s.studentId}</span> • Class {s.class}{s.section ? ' ' + s.section : ''}
                              {s.fatherName ? ` • s/o ${s.fatherName}` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {studentQuery.trim().length >= 2 && !searchingStudents && studentResults.length === 0 && (
                      <p className="text-[11px] text-slate-500 mt-1.5">No active student matches “{studentQuery.trim()}”.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Custom Tuition</label><input type="number" min="0" placeholder="Class default" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500" value={overrideForm.customTuitionFee} onChange={e=>setOverrideForm({...overrideForm, customTuitionFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Custom Transport</label><input type="number" min="0" placeholder="Class default" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500" value={overrideForm.customTransportFee} onChange={e=>setOverrideForm({...overrideForm, customTransportFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Custom Misc</label><input type="number" min="0" placeholder="Class default" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500" value={overrideForm.customMiscFee} onChange={e=>setOverrideForm({...overrideForm, customMiscFee: e.target.value})} /></div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1.5">Custom Annual</label>
                  <input type="number" min="0" placeholder="Class default" className="w-full text-xs bg-slate-900 border border-indigo-500/30 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={overrideForm.customAnnualFee} onChange={e=>setOverrideForm({...overrideForm, customAnnualFee: e.target.value})} />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                The annual fee applies whenever a challan charges it — the Generate Fees screen and
                individual challans both pick this amount up automatically, and it is still charged
                only once per session.
              </p>
              <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Reason</label><input type="text" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500" value={overrideForm.reason} onChange={e=>setOverrideForm({...overrideForm, reason: e.target.value})} /></div>
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowOverrideModal(false)} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/5 rounded-xl transition">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-purple-500/25">Save Override</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRolloverModal && (
        <div className="fixed inset-0 bg-[#080c14]/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111827] border border-white/5 rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-2">
              <ArrowRightLeft className="text-emerald-500" /> Carry/Rollover Fees
            </h2>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              This copies all Class Fee Structures and Student Fee Overrides from the source session to the target session, adding the specified tuition increment.
            </p>
            <form onSubmit={handleRolloverSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Source Session (Copy from)</label>
                <select className="w-full text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={rolloverForm.sourceSessionId} onChange={e=>setRolloverForm({...rolloverForm, sourceSessionId: e.target.value})} required>
                  <option value="" className="bg-slate-900">Select source session...</option>
                  {sessions.map(s => <option key={s._id} value={s._id} className="bg-slate-900">{s.name} {s.isActive ? '(Active)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Target Session (Copy to)</label>
                <select className="w-full text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={rolloverForm.targetSessionId} onChange={e=>setRolloverForm({...rolloverForm, targetSessionId: e.target.value})} required>
                  <option value="" className="bg-slate-900">Select target session...</option>
                  {sessions.map(s => <option key={s._id} value={s._id} className="bg-slate-900">{s.name} {s.isActive ? '(Active)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tuition Fee Increment (Rs.)</label>
                <input type="number" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" value={rolloverForm.incrementAmount} onChange={e=>setRolloverForm({...rolloverForm, incrementAmount: e.target.value})} required min="0" />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowRolloverModal(false)} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/5 rounded-xl transition">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-tr from-emerald-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-emerald-500/25">Carry Fees</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
