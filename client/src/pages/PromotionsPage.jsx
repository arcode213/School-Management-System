import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { getStudents, getClasses } from '../api/students';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Users, AlertCircle, RefreshCw, Layers } from 'lucide-react';

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
      const { data } = await getStudents({ class: sourceClass, status: 'Active', limit: 1000 });
      setStudents(data.students);

      if (data.students.length === 0) {
        toast.error('No active students found in this class');
      }
      
      const initial = {};
      data.students.forEach(s => {
        initial[s._id] = {
          studentId: s._id,
          targetClass: targetClass || sourceClass,
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
      setStudents([]);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to process promotions');
    } finally {
      setLoading(false);
    }
  };

  // Live promotion breakdown metrics
  const totalInQueue = Object.keys(promotions).length;
  const countPromoted = Object.values(promotions).filter(p => p.promotionStatus === 'Promoted').length;
  const countRepeated = Object.values(promotions).filter(p => p.promotionStatus === 'Failed').length;
  const countGraduated = Object.values(promotions).filter(p => p.promotionStatus === 'Graduated').length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold t-body tracking-tight uppercase">Academic Promotions</h1>
        <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">Carry active students into the next academic term or class levels</p>
      </div>

      {/* Configuration Panel */}
      <div className="card card-lg p-5 flex flex-wrap gap-5 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Source Class (Current Session)</label>
          <select value={sourceClass} onChange={e => setSourceClass(e.target.value)} className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer">
            <option value="" className="bg-surface-2">Select Class</option>
            {classes.map(c => <option key={c} value={c} className="bg-surface-2">{c}</option>)}
          </select>
        </div>
        
        <div className="flex-1 min-w-48">
          <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Target Academic Session</label>
          <select value={targetSession} onChange={e => setTargetSession(e.target.value)} className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer">
            <option value="" className="bg-surface-2">Select Target Session</option>
            {sessions.filter(s => s._id !== currentSession).map(s => (
              <option key={s._id} value={s._id} className="bg-surface-2">{s.name} {s.isActive ? '(Active)' : ''}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-48">
          <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Default Target Class (Optional)</label>
          <input type="text" value={targetClass} onChange={e => setTargetClass(e.target.value)} placeholder="e.g. 6" className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>

        <button onClick={loadStudents} disabled={loading} className="btn btn-primary py-3 disabled:opacity-50">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Users size={14} />}
          Load Students
        </button>
      </div>

      {/* Screen Analytics: Promotion Preview Breakdown */}
      {totalInQueue > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card card-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider t-muted">Total in Queue</p>
              <h3 className="text-xl font-extrabold t-body mt-0.5">{totalInQueue}</h3>
            </div>
            <div className="w-10 h-10 bg-surface-3 border border-line rounded-xl flex items-center justify-center t-muted">
              <Users size={16} />
            </div>
          </div>
          <div className="card card-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider t-muted">Set to Promote</p>
              <h3 className="text-xl font-extrabold t-ok mt-0.5">{countPromoted}</h3>
            </div>
            <div className="w-10 h-10 bg-ok-soft border border-ok-border rounded-xl flex items-center justify-center t-ok">
              <span className="text-xs font-bold">{Math.round((countPromoted / totalInQueue) * 100)}%</span>
            </div>
          </div>
          <div className="card card-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider t-muted">Set to Repeat</p>
              <h3 className="text-xl font-extrabold t-warn mt-0.5">{countRepeated}</h3>
            </div>
            <div className="w-10 h-10 bg-warn-soft border border-warn-border rounded-xl flex items-center justify-center t-warn">
              <span className="text-xs font-bold">{Math.round((countRepeated / totalInQueue) * 100)}%</span>
            </div>
          </div>
          <div className="card card-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider t-muted">Set to Graduate</p>
              <h3 className="text-xl font-extrabold t-brand mt-0.5">{countGraduated}</h3>
            </div>
            <div className="w-10 h-10 bg-brand-soft border border-brand-border rounded-xl flex items-center justify-center t-brand">
              <span className="text-xs font-bold">{Math.round((countGraduated / totalInQueue) * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Promotion List */}
      {students.length > 0 && (
        <div className="card card-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-line bg-surface-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider t-muted">
              <AlertCircle size={14} className="t-warn" />
              Verify {students.length} student records before remapping
            </div>
            <button onClick={submitPromotions} disabled={loading} className="btn btn-primary disabled:opacity-50">
              <Layers size={14} /> Commit Promotions
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-4">Student</th>
                  <th className="px-5 py-4">Current Class</th>
                  <th className="px-5 py-4">Promotion Decision</th>
                  <th className="px-5 py-4">Target Class</th>
                  <th className="px-5 py-4">Target Section</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line t-muted">
                {students.map(s => (
                  <tr key={s._id} className="hover:bg-surface-2 transition">
                    <td className="px-5 py-4">
                      <div className="font-bold t-body">{s.fullName}</div>
                      {s.fatherName && <div className="text-[10px] t-muted mt-0.5">s/o {s.fatherName}</div>}
                      <div className="text-[10px] font-mono t-faint mt-0.5">{s.studentId}</div>
                    </td>
                    <td className="px-5 py-4 t-muted font-semibold">Class {s.class} {s.section && `(${s.section})`}</td>
                    <td className="px-5 py-4">
                      <select 
                        value={promotions[s._id]?.promotionStatus || 'Promoted'} 
                        onChange={e => handlePromotionChange(s._id, 'promotionStatus', e.target.value)}
                        className="bg-surface-2 border border-line rounded-xl px-3 py-1.5 text-xs t-body outline-none focus:ring-1 focus:ring-brand cursor-pointer font-semibold uppercase tracking-wider"
                      >
                        <option value="Promoted">Promoted</option>
                        <option value="Failed">Failed (Repeat)</option>
                        <option value="Graduated">Graduated (Leave)</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <input 
                        type="text" 
                        value={promotions[s._id]?.targetClass || ''} 
                        onChange={e => handlePromotionChange(s._id, 'targetClass', e.target.value)}
                        disabled={promotions[s._id]?.promotionStatus === 'Graduated'}
                        className="w-20 bg-surface-2 border border-line rounded-xl px-3 py-1.5 text-xs font-bold t-body focus:outline-none focus:ring-2 focus:ring-brand text-center disabled:opacity-30"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <input 
                        type="text" 
                        value={promotions[s._id]?.targetSection || ''} 
                        onChange={e => handlePromotionChange(s._id, 'targetSection', e.target.value)}
                        disabled={promotions[s._id]?.promotionStatus === 'Graduated'}
                        className="w-16 bg-surface-2 border border-line rounded-xl px-3 py-1.5 text-xs font-bold t-body focus:outline-none focus:ring-2 focus:ring-brand text-center disabled:opacity-30"
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
