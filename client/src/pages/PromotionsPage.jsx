import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getStudents, getClasses } from '../api/students';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Users, AlertCircle, RefreshCw } from 'lucide-react';

export default function PromotionsPage() {
  const { currentCampus, currentSession, sessions } = useAppContext();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Promotion settings
  const [sourceClass, setSourceClass] = useState('');
  const [targetSession, setTargetSession] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [promotions, setPromotions] = useState({});

  useEffect(() => {
    if (currentCampus && currentSession) {
      getClasses().then(r => setClasses(r.data)).catch(() => {});
    }
  }, [currentCampus, currentSession]);

  const loadStudents = async () => {
    if (!sourceClass) return toast.error('Please select a source class first');
    setLoading(true);
    try {
      // Only Active students are eligible for promotion. Left/Graduated/Failed
      // records must never be carried into the next session.
      const { data } = await getStudents({ class: sourceClass, status: 'Active', limit: 1000 });
      setStudents(data.students);

      if (data.students.length === 0) {
        toast.error('No active students found in this class');
      }
      
      // Initialize default promotions
      const initial = {};
      data.students.forEach(s => {
        initial[s._id] = {
          studentId: s._id,
          targetClass: targetClass || sourceClass, // Default to next class if specified
          targetSection: s.section || '',
          promotionStatus: 'Promoted'
        };
      });
      setPromotions(initial);
    } catch (e) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handlePromotionChange = (studentId, field, value) => {
    setPromotions(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const submitPromotions = async () => {
    if (!targetSession) return toast.error('Please select a target session');
    
    const payload = {
      targetSessionId: targetSession,
      promotions: Object.values(promotions)
    };

    if (payload.promotions.length === 0) return toast.error('No students to promote');

    setLoading(true);
    try {
      await api.post('/students/promote', payload);
      toast.success('Students successfully promoted/processed');
      setStudents([]); // Clear list
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to process promotions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Academic Promotions Workflow</h1>
        <p className="text-slate-500 text-sm mt-1">Promote students to the next academic session and class.</p>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-6 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Source Class (Current Session)</label>
          <select value={sourceClass} onChange={e => setSourceClass(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Select Class</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Target Academic Session</label>
          <select value={targetSession} onChange={e => setTargetSession(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
            <option value="">Select Target Session</option>
            {sessions.filter(s => s._id !== currentSession).map(s => (
              <option key={s._id} value={s._id}>{s.name} {s.isActive ? '(Active)' : ''}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-48">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Default Target Class (Optional)</label>
          <input type="text" value={targetClass} onChange={e => setTargetClass(e.target.value)} placeholder="e.g. 6" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
        </div>

        <button onClick={loadStudents} disabled={loading} className="bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Users size={16} />}
          Load Students
        </button>
      </div>

      {/* Promotion List */}
      {students.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <AlertCircle size={16} className="text-amber-500" />
              Review {students.length} students before submitting
            </div>
            <button onClick={submitPromotions} disabled={loading} className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 transition disabled:opacity-50">
              Submit Promotions
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-xs uppercase font-semibold text-slate-500 sticky top-0">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Current Class</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Target Class</th>
                  <th className="px-4 py-3">Target Section</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map(s => (
                  <tr key={s._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{s.fullName}</div>
                      <div className="text-xs text-slate-500">{s.studentId}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.class} {s.section && `(${s.section})`}</td>
                    <td className="px-4 py-3">
                      <select 
                        value={promotions[s._id]?.promotionStatus || 'Promoted'} 
                        onChange={e => handlePromotionChange(s._id, 'promotionStatus', e.target.value)}
                        className="bg-white border border-slate-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Promoted">Promoted</option>
                        <option value="Failed">Failed (Repeat)</option>
                        <option value="Graduated">Graduated (Leave)</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        value={promotions[s._id]?.targetClass || ''} 
                        onChange={e => handlePromotionChange(s._id, 'targetClass', e.target.value)}
                        disabled={promotions[s._id]?.promotionStatus === 'Graduated'}
                        className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-sm disabled:bg-slate-100"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        value={promotions[s._id]?.targetSection || ''} 
                        onChange={e => handlePromotionChange(s._id, 'targetSection', e.target.value)}
                        disabled={promotions[s._id]?.promotionStatus === 'Graduated'}
                        className="w-16 bg-white border border-slate-200 rounded px-2 py-1 text-sm disabled:bg-slate-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
