import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { getFeeStructures, saveFeeStructure, getFeeOverrides, saveFeeOverride, deleteFeeOverride, rolloverFeeStructure } from '../api/fees';
import { getStudents } from '../api/students';
import toast from 'react-hot-toast';
import { Settings, Plus, Edit, Trash2, ArrowRightLeft } from 'lucide-react';
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
  const [structForm, setStructForm] = useState({ className: 'Nursery', tuitionFee: 0, admissionFee: 0, examFee: 0, transportFee: 0, miscFee: 0 });
  const [overrideForm, setOverrideForm] = useState({ student: '', customTuitionFee: '', customTransportFee: '', customMiscFee: '', reason: '' });
  const [rolloverForm, setRolloverForm] = useState({ sourceSessionId: '', targetSessionId: '', incrementAmount: 200 });

  const [students, setStudents] = useState([]);

  // Fee structures and overrides are scoped to campus + session, so reload
  // whenever either changes (e.g. switching the active session in the top bar).
  useEffect(() => {
    if (currentCampus && currentSession) fetchData();
  }, [currentCampus, currentSession]);

  const fetchData = async () => {
    try {
      const [strRes, ovrRes, stuRes] = await Promise.all([
        getFeeStructures(),
        getFeeOverrides(),
        getStudents({ status: 'Active', limit: 1000 })
      ]);
      setStructures(strRes.data);
      setOverrides(ovrRes.data);
      if (stuRes.data.students) setStudents(stuRes.data.students);
    } catch (err) {
      toast.error('Failed to load fee structures');
    }
  };

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
        miscFee: st.miscFee
      });
    } else {
      setStructForm({ className: 'Nursery', tuitionFee: 0, admissionFee: 0, examFee: 0, transportFee: 0, miscFee: 0 });
    }
    setShowStructModal(true);
  };

  const openRolloverModal = () => {
    // Attempt to guess source (current) and target (next)
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="text-blue-600" /> Fee Structure
        </h1>
        <div className="flex items-center gap-3">
          {user?.role !== 'Staff' && (
            <button onClick={openRolloverModal} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
              <ArrowRightLeft size={18} /> Carry/Rollover Fees
            </button>
          )}
          {activeTab === 'class' ? (
            <button onClick={() => openStructModal()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
              <Plus size={18} /> Set Class Fee
            </button>
          ) : (
            <button onClick={() => { setOverrideForm({ student: '', customTuitionFee: '', customTransportFee: '', customMiscFee: '', reason: '' }); setShowOverrideModal(true); }} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700">
              <Plus size={18} /> Add Student Override
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200">
        <button
          className={`pb-2 px-4 font-medium transition-colors ${activeTab === 'class' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('class')}
        >
          Class Fee Structures
        </button>
        <button
          className={`pb-2 px-4 font-medium transition-colors ${activeTab === 'override' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('override')}
        >
          Student Fee Overrides
        </button>
      </div>

      {activeTab === 'class' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                <th className="p-4 font-semibold">Class</th>
                <th className="p-4 font-semibold">Tuition Fee</th>
                <th className="p-4 font-semibold">Admission Fee</th>
                <th className="p-4 font-semibold">Exam Fee</th>
                <th className="p-4 font-semibold">Transport Fee</th>
                <th className="p-4 font-semibold">Misc Fee</th>
                <th className="p-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {structures.map(s => (
                <tr key={s._id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4 font-medium">{s.className}</td>
                  <td className="p-4">Rs {s.tuitionFee}</td>
                  <td className="p-4">Rs {s.admissionFee}</td>
                  <td className="p-4">Rs {s.examFee}</td>
                  <td className="p-4">Rs {s.transportFee}</td>
                  <td className="p-4">Rs {s.miscFee}</td>
                  <td className="p-4">
                    <button onClick={() => openStructModal(s)} className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
                  </td>
                </tr>
              ))}
              {structures.length === 0 && (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">No class fee structures defined yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'override' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
                <th className="p-4 font-semibold">Student</th>
                <th className="p-4 font-semibold">Custom Tuition</th>
                <th className="p-4 font-semibold">Custom Transport</th>
                <th className="p-4 font-semibold">Reason</th>
                <th className="p-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {overrides.map(o => (
                <tr key={o._id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    <p className="font-medium text-slate-800">{o.student?.fullName}</p>
                    <p className="text-xs text-slate-500">{o.student?.studentId}</p>
                  </td>
                  <td className="p-4">{o.customTuitionFee !== null ? `Rs ${o.customTuitionFee}` : '-'}</td>
                  <td className="p-4">{o.customTransportFee !== null ? `Rs ${o.customTransportFee}` : '-'}</td>
                  <td className="p-4">{o.reason || '-'}</td>
                  <td className="p-4">
                    {user?.role !== 'Staff' && (
                      <button onClick={() => handleDeleteOverride(o._id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                    )}
                  </td>
                </tr>
              ))}
              {overrides.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">No student overrides defined.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showStructModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Set Class Fee Structure</h2>
            <form onSubmit={handleStructSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Class</label>
                <select className="w-full p-2 border rounded" value={structForm.className} onChange={e=>setStructForm({...structForm, className: e.target.value})} required>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Tuition Fee</label><input type="number" className="w-full p-2 border rounded" value={structForm.tuitionFee} onChange={e=>setStructForm({...structForm, tuitionFee: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1">Transport Fee</label><input type="number" className="w-full p-2 border rounded" value={structForm.transportFee} onChange={e=>setStructForm({...structForm, transportFee: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1">Admission Fee</label><input type="number" className="w-full p-2 border rounded" value={structForm.admissionFee} onChange={e=>setStructForm({...structForm, admissionFee: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1">Exam Fee</label><input type="number" className="w-full p-2 border rounded" value={structForm.examFee} onChange={e=>setStructForm({...structForm, examFee: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1">Misc Fee</label><input type="number" className="w-full p-2 border rounded" value={structForm.miscFee} onChange={e=>setStructForm({...structForm, miscFee: e.target.value})} /></div>
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowStructModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Structure</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOverrideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Add Student Override</h2>
            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Student</label>
                <select className="w-full p-2 border rounded" value={overrideForm.student} onChange={e=>setOverrideForm({...overrideForm, student: e.target.value})} required>
                  <option value="">Select a student...</option>
                  {students.map(s => <option key={s._id} value={s._id}>{s.fullName} ({s.studentId})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Custom Tuition</label><input type="number" className="w-full p-2 border rounded" value={overrideForm.customTuitionFee} onChange={e=>setOverrideForm({...overrideForm, customTuitionFee: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1">Custom Transport</label><input type="number" className="w-full p-2 border rounded" value={overrideForm.customTransportFee} onChange={e=>setOverrideForm({...overrideForm, customTransportFee: e.target.value})} /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Reason</label><input type="text" className="w-full p-2 border rounded" value={overrideForm.reason} onChange={e=>setOverrideForm({...overrideForm, reason: e.target.value})} /></div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowOverrideModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Save Override</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRolloverModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ArrowRightLeft className="text-emerald-600" /> Carry/Rollover Fees
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              This copies all Class Fee Structures and Student Fee Overrides from the source session to the target session, adding the specified tuition increment.
            </p>
            <form onSubmit={handleRolloverSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Source Session (Copy from)</label>
                <select className="w-full p-2 border rounded" value={rolloverForm.sourceSessionId} onChange={e=>setRolloverForm({...rolloverForm, sourceSessionId: e.target.value})} required>
                  <option value="">Select source session...</option>
                  {sessions.map(s => <option key={s._id} value={s._id}>{s.name} {s.isActive ? '(Active)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target Session (Copy to)</label>
                <select className="w-full p-2 border rounded" value={rolloverForm.targetSessionId} onChange={e=>setRolloverForm({...rolloverForm, targetSessionId: e.target.value})} required>
                  <option value="">Select target session...</option>
                  {sessions.map(s => <option key={s._id} value={s._id}>{s.name} {s.isActive ? '(Active)' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tuition Fee Increment (Rs.)</label>
                <input type="number" className="w-full p-2 border rounded" value={rolloverForm.incrementAmount} onChange={e=>setRolloverForm({...rolloverForm, incrementAmount: e.target.value})} required min="0" />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setShowRolloverModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium">Carry Fees</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
