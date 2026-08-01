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
        <h1 className="text-2xl font-bold text-white tracking-tight uppercase">Academic Promotions</h1>
        <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-wider">Carry active students into the next academic term or class levels</p>
      </div>

      {/* Configuration Panel */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 p-5 rounded-3xl flex flex-wrap gap-5 items-end shadow-xl">
        <div className="flex-1 min-w-48">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Source Class (Current Session)</label>
          <select value={sourceClass} onChange={e => setSourceClass(e.target.value)} className="w-full text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
            <option value="" className="bg-slate-900">Select Class</option>
            {classes.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
          </select>
        </div>
        
        <div className="flex-1 min-w-48">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Target Academic Session</label>
          <select value={targetSession} onChange={e => setTargetSession(e.target.value)} className="w-full text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
            <option value="" className="bg-slate-900">Select Target Session</option>
            {sessions.filter(s => s._id !== currentSession).map(s => (
              <option key={s._id} value={s._id} className="bg-slate-900">{s.name} {s.isActive ? '(Active)' : ''}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-48">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Default Target Class (Optional)</label>
          <input type="text" value={targetClass} onChange={e => setTargetClass(e.target.value)} placeholder="e.g. 6" className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <button onClick={loadStudents} disabled={loading} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl px-5 py-3 transition shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Users size={14} />}
          Load Students
        </button>
      </div>

      {/* Screen Analytics: Promotion Preview Breakdown */}
      {totalInQueue > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-4 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total in Queue</p>
              <h3 className="text-xl font-extrabold text-white mt-0.5">{totalInQueue}</h3>
            </div>
            <div className="w-10 h-10 bg-slate-800 border border-white/5 rounded-xl flex items-center justify-center text-slate-400">
              <Users size={16} />
            </div>
          </div>
          <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-4 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Set to Promote</p>
              <h3 className="text-xl font-extrabold text-emerald-400 mt-0.5">{countPromoted}</h3>
            </div>
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
              <span className="text-xs font-bold">{Math.round((countPromoted / totalInQueue) * 100)}%</span>
            </div>
          </div>
          <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-4 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Set to Repeat</p>
              <h3 className="text-xl font-extrabold text-amber-400 mt-0.5">{countRepeated}</h3>
            </div>
            <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
              <span className="text-xs font-bold">{Math.round((countRepeated / totalInQueue) * 100)}%</span>
            </div>
          </div>
          <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-4 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Set to Graduate</p>
              <h3 className="text-xl font-extrabold text-blue-400 mt-0.5">{countGraduated}</h3>
            </div>
            <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
              <span className="text-xs font-bold">{Math.round((countGraduated / totalInQueue) * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Promotion List */}
      {students.length > 0 && (
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          <div className="p-4 border-b border-white/5 bg-white/3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <AlertCircle size={14} className="text-amber-500" />
              Verify {students.length} student records before remapping
            </div>
            <button onClick={submitPromotions} disabled={loading} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-tr from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 rounded-xl px-4 py-2.5 transition shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50">
              <Layers size={14} /> Commit Promotions
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-[60vh]">
            <table className="w-full text-xs text-left">
              <thead className="bg-white/3 border-b border-white/5 text-slate-400 uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-4">Student</th>
                  <th className="px-5 py-4">Current Class</th>
                  <th className="px-5 py-4">Promotion Decision</th>
                  <th className="px-5 py-4">Target Class</th>
                  <th className="px-5 py-4">Target Section</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/3 text-slate-300">
                {students.map(s => (
                  <tr key={s._id} className="hover:bg-white/3 transition">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white">{s.fullName}</div>
                      {s.fatherName && <div className="text-[10px] text-slate-400 mt-0.5">s/o {s.fatherName}</div>}
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">{s.studentId}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-300 font-semibold">Class {s.class} {s.section && `(${s.section})`}</td>
                    <td className="px-5 py-4">
                      <select 
                        value={promotions[s._id]?.promotionStatus || 'Promoted'} 
                        onChange={e => handlePromotionChange(s._id, 'promotionStatus', e.target.value)}
                        className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer font-semibold uppercase tracking-wider"
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
                        className="w-20 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center disabled:opacity-30"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <input 
                        type="text" 
                        value={promotions[s._id]?.targetSection || ''} 
                        onChange={e => handlePromotionChange(s._id, 'targetSection', e.target.value)}
                        disabled={promotions[s._id]?.promotionStatus === 'Graduated'}
                        className="w-16 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center disabled:opacity-30"
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
