import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { getFeeStructures, saveFeeStructure, getFeeOverrides, saveFeeOverride, deleteFeeOverride, rolloverFeeStructure } from '../api/fees';
import { getStudents } from '../api/students';
import toast from 'react-hot-toast';
import { Settings, Plus, Edit, Trash2, ArrowRightLeft, Landmark, Users, Search, Loader2, X } from 'lucide-react';
import { CLASSES } from '../utils/constants';

export default function FeeStructurePage() {
  const { can } = useAuth();
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
  const [overrideSearch, setOverrideSearch] = useState('');

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

  const filteredOverrides = overrides.filter(o => {
    if (!overrideSearch.trim()) return true;
    const q = overrideSearch.toLowerCase().trim();
    const name = (o.student?.fullName || '').toLowerCase();
    const sId = (o.student?.studentId || '').toLowerCase();
    const father = (o.student?.fatherName || '').toLowerCase();
    const reason = (o.reason || '').toLowerCase();
    return name.includes(q) || sId.includes(q) || father.includes(q) || reason.includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold t-body tracking-tight uppercase flex items-center gap-2">
            <Settings className="t-brand flex-shrink-0" /> Fee Settings
          </h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">Configure class structures and student adjustments</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {can('feeStructures', 'create') && (
            <button onClick={openRolloverModal} className="btn btn-ghost">
              <ArrowRightLeft size={14} /> Carry/Rollover Fees
            </button>
          )}
          {!can('feeStructures', 'edit') ? null : activeTab === 'class' ? (
            <button onClick={() => openStructModal()} className="btn btn-primary">
              <Plus size={14} /> Set Class Fee
            </button>
          ) : (
            <button onClick={() => openOverrideModal()} className="btn btn-primary">
              <Plus size={14} /> Add Override
            </button>
          )}
        </div>
      </div>

      {/* Screen Analytics Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Landmark className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Average Monthly Tuition</p>
            <p className="text-xl sm:text-2xl font-extrabold t-brand mt-0.5 tracking-tight break-words">Rs. {averageTuition.toLocaleString()}</p>
            <p className="t-faint text-xs mt-1 font-medium">Class-wise standard mean rate</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Users className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Custom Overrides</p>
            <p className="text-xl sm:text-2xl font-extrabold t-brand mt-0.5 tracking-tight break-words">{overridesCount} accounts</p>
            <p className="t-faint text-xs mt-1 font-medium">Students with override adjustments</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-amber-600/80 to-amber-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Settings className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Highest Tuition Rate</p>
            <p className="text-xl sm:text-2xl font-extrabold t-warn mt-0.5 tracking-tight break-words">
              {highestTuition ? `Rs. ${highestTuition.tuitionFee.toLocaleString()}` : '—'}
            </p>
            <p className="t-faint text-xs mt-1 font-medium truncate">
              {highestTuition ? `Applied on Class ${highestTuition.className}` : 'No class limits registered'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-strip gap-4 border-b border-line">
        <button
          className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'class' ? 'border-b-2 border-brand t-brand' : 't-muted hover:t-body'}`}
          onClick={() => setActiveTab('class')}
        >
          Class Fee Structures
        </button>
        <button
          className={`pb-2.5 px-4 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'override' ? 'border-b-2 border-purple-500 t-brand' : 't-muted hover:t-body'}`}
          onClick={() => setActiveTab('override')}
        >
          Student Fee Overrides
        </button>
      </div>

      {/* Table grids */}
      {activeTab === 'class' && (
        <div className="card card-lg overflow-hidden">
          <div className="table-scroll">
            <table className="w-full text-xs text-left rtable">
              <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
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
              <tbody className="divide-y divide-line t-muted">
                {structures.map(s => (
                  <tr key={s._id} className="hover:bg-surface-2 transition">
                    <td data-label="Class" className="p-4 font-bold t-body">Class {s.className}</td>
                    <td data-label="Tuition Fee" className="p-4 font-semibold">Rs {s.tuitionFee?.toLocaleString()}</td>
                    <td data-label="Admission Fee" className="p-4">Rs {s.admissionFee?.toLocaleString()}</td>
                    <td data-label="Exam Fee" className="p-4">Rs {s.examFee?.toLocaleString()}</td>
                    <td data-label="Transport Fee" className="p-4">Rs {s.transportFee?.toLocaleString()}</td>
                    <td data-label="Misc Fee" className="p-4">Rs {s.miscFee?.toLocaleString()}</td>
                    <td data-label="Annual Fee" className="p-4 font-bold t-brand">Rs {(s.annualFee || 0).toLocaleString()}</td>
                    <td data-actions="" className="p-4">
                      {can('feeStructures', 'edit') && (
                        <button onClick={() => openStructModal(s)} className="p-2 t-muted hover:t-brand hover:bg-brand-soft border border-transparent hover:border-brand-border rounded-xl transition"><Edit size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
                {structures.length === 0 && (
                  <tr className="row-plain">
                    <td colSpan="8" className="p-12 text-center t-faint font-medium">No class fee structures defined yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'override' && (
        <div className="space-y-3">
          {/* Search bar for student overrides */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-2 border border-line rounded-2xl p-3 sm:px-4">
            <div className="flex items-center gap-2.5 flex-1 min-w-0 bg-surface-1 border border-line rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-brand">
              <Search size={15} className="t-faint flex-shrink-0" />
              <input
                type="text"
                placeholder="Search overrides by student name, ID, father name, or reason..."
                className="bg-transparent outline-none w-full text-xs t-body placeholder-faint font-semibold"
                value={overrideSearch}
                onChange={e => setOverrideSearch(e.target.value)}
              />
              {overrideSearch && (
                <button
                  type="button"
                  onClick={() => setOverrideSearch('')}
                  className="t-faint hover:t-body p-0.5 rounded transition"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="text-[11px] font-bold t-muted uppercase tracking-wider whitespace-nowrap pl-1 sm:pl-0">
              {overrideSearch.trim() ? (
                <span>Showing {filteredOverrides.length} of {overrides.length}</span>
              ) : (
                <span>Total Overrides: {overrides.length}</span>
              )}
            </div>
          </div>

          <div className="card card-lg overflow-hidden">
            <div className="table-scroll">
              <table className="w-full text-xs text-left rtable">
                <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
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
                <tbody className="divide-y divide-line t-muted">
                  {filteredOverrides.map(o => (
                    <tr key={o._id} className="hover:bg-surface-2 transition">
                      <td data-label="Student" className="p-4">
                        <div>
                          <p className="font-bold t-body">{o.student?.fullName}</p>
                          <p className="text-[10px] font-mono t-faint mt-0.5">
                            {o.student?.studentId}
                            {o.student?.fatherName && ` • s/o ${o.student.fatherName}`}
                          </p>
                        </div>
                      </td>
                      <td data-label="Custom Tuition" className="p-4 font-bold t-brand">{fmtOverride(o.customTuitionFee)}</td>
                      <td data-label="Custom Transport" className="p-4 font-semibold t-muted">{fmtOverride(o.customTransportFee)}</td>
                      <td data-label="Custom Misc" className="p-4 font-semibold t-muted">{fmtOverride(o.customMiscFee)}</td>
                      <td data-label="Custom Annual" className="p-4 font-bold t-brand">{fmtOverride(o.customAnnualFee)}</td>
                      <td data-label="Reason" className="p-4 t-muted">{o.reason || '—'}</td>
                      <td data-actions="" className="p-4">
                        <div className="flex items-center gap-1">
                          {can('feeStructures', 'edit') && (
                            <button onClick={() => openOverrideModal(o)} className="p-2 t-muted hover:t-brand hover:bg-brand-soft border border-transparent hover:border-brand-border rounded-xl transition" title="Edit override"><Edit size={14} /></button>
                          )}
                          {can('feeStructures', 'delete') && (
                            <button onClick={() => handleDeleteOverride(o._id)} className="p-2 t-muted hover:t-bad hover:bg-bad-soft border border-transparent hover:border-bad-border rounded-xl transition" title="Delete override"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {overrides.length === 0 && (
                    <tr className="row-plain">
                      <td colSpan="7" className="p-12 text-center t-faint font-medium">No student overrides defined yet.</td>
                    </tr>
                  )}
                  {overrides.length > 0 && filteredOverrides.length === 0 && (
                    <tr className="row-plain">
                      <td colSpan="7" className="p-12 text-center t-faint font-medium">
                        No student overrides found matching &ldquo;{overrideSearch}&rdquo;.
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setOverrideSearch('')}
                            className="text-xs t-brand font-bold uppercase tracking-wider hover:underline"
                          >
                            Clear search
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showStructModal && (
        <div className="modal-shell bg-black/55 backdrop-blur-sm">
          <div className="card card-lg modal-box sm:max-w-md p-5 sm:p-6 overflow-y-auto">
            <h2 className="text-base font-bold uppercase tracking-wider t-body mb-4">Set Class Fee Structure</h2>
            <form onSubmit={handleStructSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Class</label>
                <select className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body outline-none focus:ring-2 focus:ring-brand" value={structForm.className} onChange={e=>setStructForm({...structForm, className: e.target.value})} required>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Tuition Fee</label><input type="number" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={structForm.tuitionFee} onChange={e=>setStructForm({...structForm, tuitionFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Transport Fee</label><input type="number" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={structForm.transportFee} onChange={e=>setStructForm({...structForm, transportFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Admission Fee</label><input type="number" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={structForm.admissionFee} onChange={e=>setStructForm({...structForm, admissionFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Exam Fee</label><input type="number" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={structForm.examFee} onChange={e=>setStructForm({...structForm, examFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Misc Fee</label><input type="number" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={structForm.miscFee} onChange={e=>setStructForm({...structForm, miscFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Annual Fee</label><input type="number" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={structForm.annualFee} onChange={e=>setStructForm({...structForm, annualFee: e.target.value})} /></div>
              </div>
              <div className="modal-actions pt-4 border-t border-line">
                <button type="button" onClick={() => setShowStructModal(false)} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted hover:bg-surface-2 border border-line rounded-xl transition">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Structure</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOverrideModal && (
        <div className="modal-shell bg-black/55 backdrop-blur-sm">
          <div className="card card-lg modal-box sm:max-w-md p-5 sm:p-6 overflow-y-auto">
            <h2 className="text-base font-bold uppercase tracking-wider t-body mb-1">
              {editingOverride ? 'Edit Student Override' : 'Add Student Override'}
            </h2>
            <p className="text-xs t-muted mb-4 leading-relaxed">
              Set only the fees that differ for this student. Leave a box <strong>empty</strong> to use
              the class fee structure; enter <strong>0</strong> to excuse that fee entirely.
            </p>
            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Student</label>

                {overrideStudent ? (
                  <div className="flex items-center justify-between gap-3 bg-surface-2 border border-brand-border rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold t-body truncate">{overrideStudent.fullName}</p>
                      <p className="text-[10px] t-faint mt-0.5 truncate">
                        <span className="font-mono">{overrideStudent.studentId}</span>
                        {overrideStudent.class ? ` • Class ${overrideStudent.class}${overrideStudent.section ? ' ' + overrideStudent.section : ''}` : ''}
                        {overrideStudent.fatherName ? ` • s/o ${overrideStudent.fatherName}` : ''}
                      </p>
                    </div>
                    {/* Editing an existing override keeps the student fixed — it is what
                        the record is keyed by. */}
                    {!editingOverride && (
                      <button type="button" onClick={clearOverrideStudent}
                        className="flex-shrink-0 t-faint hover:t-bad transition" title="Choose a different student">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center gap-2 bg-surface-2 border border-line rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand">
                      <Search size={14} className="t-faint flex-shrink-0" />
                      <input
                        autoFocus
                        type="text"
                        value={studentQuery}
                        onChange={e => setStudentQuery(e.target.value)}
                        placeholder="Search by name, ID, father or roll no..."
                        className="bg-transparent outline-none w-full text-xs t-body placeholder-faint font-medium"
                      />
                      {searchingStudents && <Loader2 size={13} className="animate-spin t-faint flex-shrink-0" />}
                    </div>

                    {studentResults.length > 0 && (
                      <div className="card card-lg absolute z-20 mt-1 w-full border-line rounded-xl max-h-56 overflow-y-auto">
                        {studentResults.map(s => (
                          <button
                            key={s.academicRecordId || s._id}
                            type="button"
                            onClick={() => selectOverrideStudent(s)}
                            className="w-full text-left px-3 py-2.5 hover:bg-surface-2 border-b border-line last:border-0 transition"
                          >
                            <div className="text-xs font-bold t-body flex items-center gap-1.5">
                              {s.fullName}
                              {overriddenStudentIds.has(String(s._id)) && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-brand-soft border border-brand-border t-brand">
                                  Has override
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] t-faint mt-0.5">
                              <span className="font-mono">{s.studentId}</span> • Class {s.class}{s.section ? ' ' + s.section : ''}
                              {s.fatherName ? ` • s/o ${s.fatherName}` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {studentQuery.trim().length >= 2 && !searchingStudents && studentResults.length === 0 && (
                      <p className="text-[11px] t-faint mt-1.5">No active student matches “{studentQuery.trim()}”.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Custom Tuition</label><input type="number" min="0" placeholder="Class default" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={overrideForm.customTuitionFee} onChange={e=>setOverrideForm({...overrideForm, customTuitionFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Custom Transport</label><input type="number" min="0" placeholder="Class default" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={overrideForm.customTransportFee} onChange={e=>setOverrideForm({...overrideForm, customTransportFee: e.target.value})} /></div>
                <div><label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Custom Misc</label><input type="number" min="0" placeholder="Class default" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={overrideForm.customMiscFee} onChange={e=>setOverrideForm({...overrideForm, customMiscFee: e.target.value})} /></div>
                <div>
                  <label className="block text-[10px] font-bold t-brand uppercase tracking-widest mb-1.5">Custom Annual</label>
                  <input type="number" min="0" placeholder="Class default" className="w-full text-xs bg-surface-2 border border-brand-border rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={overrideForm.customAnnualFee} onChange={e=>setOverrideForm({...overrideForm, customAnnualFee: e.target.value})} />
                </div>
              </div>
              <p className="text-[11px] t-faint leading-relaxed">
                The annual fee applies whenever a challan charges it — the Generate Fees screen and
                individual challans both pick this amount up automatically, and it is still charged
                only once per session.
              </p>
              <div><label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Reason</label><input type="text" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body placeholder-faint focus:outline-none focus:ring-2 focus:ring-brand" value={overrideForm.reason} onChange={e=>setOverrideForm({...overrideForm, reason: e.target.value})} /></div>
              <div className="modal-actions pt-4 border-t border-line">
                <button type="button" onClick={() => setShowOverrideModal(false)} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted hover:bg-surface-2 border border-line rounded-xl transition">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Override</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRolloverModal && (
        <div className="modal-shell bg-black/55 backdrop-blur-sm">
          <div className="card card-lg modal-box sm:max-w-md p-5 sm:p-6 overflow-y-auto">
            <h2 className="text-base font-bold uppercase tracking-wider t-body mb-4 flex items-center gap-2">
              <ArrowRightLeft className="t-ok" /> Carry/Rollover Fees
            </h2>
            <p className="text-xs t-muted mb-4 leading-relaxed">
              This copies all Class Fee Structures and Student Fee Overrides from the source session to the target session, adding the specified tuition increment.
            </p>
            <form onSubmit={handleRolloverSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Source Session (Copy from)</label>
                <select className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body outline-none focus:ring-2 focus:ring-brand" value={rolloverForm.sourceSessionId} onChange={e=>setRolloverForm({...rolloverForm, sourceSessionId: e.target.value})} required>
                  <option value="" className="bg-surface-2">Select source session...</option>
                  {sessions.map(s => <option key={s._id} value={s._id} className="bg-surface-2">{s.name} {s.isActive ? '(Active)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Target Session (Copy to)</label>
                <select className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body outline-none focus:ring-2 focus:ring-brand" value={rolloverForm.targetSessionId} onChange={e=>setRolloverForm({...rolloverForm, targetSessionId: e.target.value})} required>
                  <option value="" className="bg-surface-2">Select target session...</option>
                  {sessions.map(s => <option key={s._id} value={s._id} className="bg-surface-2">{s.name} {s.isActive ? '(Active)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Tuition Fee Increment (Rs.)</label>
                <input type="number" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" value={rolloverForm.incrementAmount} onChange={e=>setRolloverForm({...rolloverForm, incrementAmount: e.target.value})} required min="0" />
              </div>
              <div className="modal-actions pt-4 border-t border-line">
                <button type="button" onClick={() => setShowRolloverModal(false)} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted hover:bg-surface-2 border border-line rounded-xl transition">Cancel</button>
                <button type="submit" className="btn btn-primary">Carry Fees</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
