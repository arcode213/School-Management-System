import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

// Must match RESET_CONFIRMATION on the server, which rejects anything else.
const RESET_PHRASE = 'DELETE DATA';

// Mirrors RESET_GROUPS / RESET_DEPENDENCIES in systemController. Campuses, academic
// sessions and user accounts are not offered here — see the note on the server.
const RESET_GROUPS = [
  { key: 'students', label: 'Students & academic records', hint: 'Every student, plus their class/section history' },
  { key: 'fees', label: 'Challans, payments & dues', hint: 'All fee records, including imported opening balances' },
  { key: 'feeOverrides', label: 'Per-student fee overrides', hint: 'Custom tuition / transport / misc amounts' },
  { key: 'employees', label: 'Employees', hint: 'All staff records' },
  { key: 'salaries', label: 'Salary records', hint: 'Posted salary slips' },
  { key: 'feeStructures', label: 'Class fee structures', hint: 'Per-class fee amounts for each session' },
];

// Ticking a parent forces its dependents — a challan whose student is gone points
// at nothing. The server applies the same rule regardless of what the client sends.
const RESET_DEPENDENCIES = { students: ['fees', 'feeOverrides'], employees: ['salaries'] };

export default function SystemSettingsPage() {
  const { campuses, sessions, setCurrentCampus, setCurrentSession } = useAppContext();
  // Someone can be granted a look at the campus and session setup without being
  // able to change it, so the forms and row buttons are gated separately from the
  // screen itself. Wiping the school's data is never grantable — Admin only, and
  // the server enforces the same.
  const { can, isAdmin } = useAuth();
  const canWriteSettings = can('settings', 'create') || can('settings', 'edit');

  const [activeTab, setActiveTab] = useState('campuses');
  const [localCampuses, setLocalCampuses] = useState([]);
  const [localSessions, setLocalSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [campusForm, setCampusForm] = useState({ name: '', code: '', address: '', contactNumber: '', isActive: true });
  const [sessionForm, setSessionForm] = useState({ name: '', startDate: '', endDate: '', status: 'Upcoming', isActive: true });

  // Edit states (null = creating a new record)
  const [editingCampusId, setEditingCampusId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);

  // Danger zone
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetChecked, setResetChecked] = useState({});

  // Groups pulled in by a ticked parent rather than chosen directly.
  const resetForced = useMemo(() => {
    const forced = new Set();
    for (const [parent, dependents] of Object.entries(RESET_DEPENDENCIES)) {
      if (resetChecked[parent]) dependents.forEach(d => forced.add(d));
    }
    return forced;
  }, [resetChecked]);

  const resetSelection = RESET_GROUPS
    .filter(g => resetChecked[g.key] || resetForced.has(g.key))
    .map(g => g.key);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [campRes, sessRes] = await Promise.all([
        api.get('/system/campuses'),
        api.get('/system/sessions')
      ]);
      setLocalCampuses(campRes.data);
      setLocalSessions(sessRes.data);
    } catch (err) {
      toast.error('Failed to load system data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetCampusForm = () => {
    setEditingCampusId(null);
    setCampusForm({ name: '', code: '', address: '', contactNumber: '', isActive: true });
  };

  const resetSessionForm = () => {
    setEditingSessionId(null);
    setSessionForm({ name: '', startDate: '', endDate: '', status: 'Upcoming', isActive: true });
  };

  const handleSaveCampus = async (e) => {
    e.preventDefault();
    try {
      if (editingCampusId) {
        await api.put(`/system/campuses/${editingCampusId}`, campusForm);
        toast.success('Campus updated successfully');
      } else {
        await api.post('/system/campuses', campusForm);
        toast.success('Campus created successfully');
      }
      resetCampusForm();
      fetchData();
      // Reload so the global app context (campus switcher) picks up the change.
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save campus');
    }
  };

  const handleEditCampus = (campus) => {
    setActiveTab('campuses');
    setEditingCampusId(campus._id);
    setCampusForm({
      name: campus.name || '',
      code: campus.code || '',
      address: campus.address || '',
      contactNumber: campus.phone || campus.contactNumber || '',
      isActive: campus.isActive,
    });
  };

  const handleDeleteCampus = async (campus) => {
    if (!window.confirm(`Delete campus "${campus.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/system/campuses/${campus._id}`);
      toast.success('Campus deleted');
      // If the deleted campus was the active selection, clear it.
      if (localStorage.getItem('sms_campus') === campus._id) localStorage.removeItem('sms_campus');
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete campus');
    }
  };

  const handleSaveSession = async (e) => {
    e.preventDefault();
    try {
      if (editingSessionId) {
        await api.put(`/system/sessions/${editingSessionId}`, sessionForm);
        toast.success('Session updated successfully');
      } else {
        await api.post('/system/sessions', sessionForm);
        toast.success('Session created successfully');
      }
      resetSessionForm();
      fetchData();
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save session');
    }
  };

  const handleEditSession = (session) => {
    setActiveTab('sessions');
    setEditingSessionId(session._id);
    setSessionForm({
      name: session.name || '',
      startDate: session.startDate ? session.startDate.substring(0, 10) : '',
      endDate: session.endDate ? session.endDate.substring(0, 10) : '',
      status: session.status || 'Upcoming',
      isActive: session.isActive,
    });
  };

  const handleDeleteSession = async (session) => {
    if (!window.confirm(`Delete session "${session.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/system/sessions/${session._id}`);
      toast.success('Session deleted');
      if (localStorage.getItem('sms_session') === session._id) localStorage.removeItem('sms_session');
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete session');
    }
  };

  const handleResetData = async () => {
    if (resetPhrase !== RESET_PHRASE || resetSelection.length === 0) return;

    const labels = RESET_GROUPS.filter(g => resetSelection.includes(g.key)).map(g => `  • ${g.label}`);
    if (!window.confirm(
      'This permanently deletes:\n\n' + labels.join('\n') +
      '\n\nCampuses, academic sessions and login accounts are kept.\n\n' +
      'There is no undo. Continue?'
    )) return;

    setResetting(true);
    try {
      const { data } = await api.post('/system/reset-data', { confirm: RESET_PHRASE, groups: resetSelection });
      toast.success(data.message || 'Selected data deleted');
      setResetPhrase('');
      setResetChecked({});
      // Every page in the app is showing data that no longer exists.
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete data');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold t-body mb-6">System Settings</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-line">
        <button
          className={`py-2 px-4 font-semibold ${activeTab === 'campuses' ? 't-brand border-b-2 border-brand' : 't-faint hover:t-body'}`}
          onClick={() => setActiveTab('campuses')}
        >
          Campuses
        </button>
        <button
          className={`py-2 px-4 font-semibold ${activeTab === 'sessions' ? 't-brand border-b-2 border-brand' : 't-faint hover:t-body'}`}
          onClick={() => setActiveTab('sessions')}
        >
          Academic Sessions
        </button>
        {isAdmin && (
          <button
            className={`py-2 px-4 font-semibold ${activeTab === 'danger' ? 't-bad border-b-2 border-red-600' : 't-faint hover:t-bad'}`}
            onClick={() => setActiveTab('danger')}
          >
            Danger Zone
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div></div>
      ) : activeTab === 'danger' && isAdmin ? (
        <div className="max-w-2xl">
          <div className="bg-solid border-2 border-bad-border rounded-xl overflow-hidden shadow">
            <div className="bg-bad-soft border-b border-bad-border px-6 py-4">
              <h2 className="text-lg font-bold t-bad">Delete Data</h2>
              <p className="text-sm t-bad mt-0.5">
                Tick only what you want removed. This cannot be undone — take a database backup first.
              </p>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                {RESET_GROUPS.map(group => {
                  const isForced = resetForced.has(group.key);
                  const isChecked = !!resetChecked[group.key] || isForced;
                  const forcedBy = RESET_GROUPS.find(
                    g => (RESET_DEPENDENCIES[g.key] || []).includes(group.key) && resetChecked[g.key]
                  );
                  return (
                    <label
                      key={group.key}
                      htmlFor={`reset-${group.key}`}
                      className={`flex items-start gap-3 p-3 border rounded-lg transition ${
                        isChecked ? 'border-bad-border bg-bad-soft' : 'border-line hover:bg-surface-2'
                      } ${isForced ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <input
                        id={`reset-${group.key}`}
                        type="checkbox"
                        checked={isChecked}
                        disabled={isForced}
                        onChange={e => setResetChecked(prev => ({ ...prev, [group.key]: e.target.checked }))}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium t-body">
                          {group.label}
                          {isForced && forcedBy && (
                            <span className="ml-2 text-xs font-normal t-bad">
                              — included with “{forcedBy.label}”
                            </span>
                          )}
                        </span>
                        <span className="block text-xs t-faint mt-0.5">{group.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <p className="text-xs t-faint bg-surface-2 border border-line rounded p-2.5">
                <strong className="t-body">Always kept:</strong> campuses, academic sessions, and user accounts
                &amp; logins.
              </p>

              <div className="pt-2 border-t border-line">
                <label className="block text-sm font-medium t-body mb-1">
                  Type <code className="bg-surface-2 border px-1.5 py-0.5 rounded t-bad font-bold">{RESET_PHRASE}</code> to enable the button
                </label>
                <input
                  type="text"
                  value={resetPhrase}
                  onChange={e => setResetPhrase(e.target.value)}
                  placeholder={RESET_PHRASE}
                  autoComplete="off"
                  className="w-full p-2 border border-line rounded focus:ring-bad focus:border-red-500"
                />
              </div>

              <button
                onClick={handleResetData}
                disabled={resetPhrase !== RESET_PHRASE || resetSelection.length === 0 || resetting}
                className="w-full bg-bad t-body font-bold py-2.5 px-4 rounded hover:bg-bad transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {resetting
                  ? 'Deleting...'
                  : resetSelection.length === 0
                    ? 'Select what to delete'
                    : `Delete ${resetSelection.length} selected type${resetSelection.length === 1 ? '' : 's'} permanently`}
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'campuses' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Read-only access shows the list alone; the editor is not drawn at all
              rather than drawn and rejected on save. */}
          {canWriteSettings && (
          <div className="md:col-span-1 bg-solid p-6 rounded-xl shadow border border-line">
            <h2 className="text-xl font-bold mb-4">{editingCampusId ? 'Edit Campus' : 'Add New Campus'}</h2>
            <form onSubmit={handleSaveCampus} className="space-y-4">
              <div>
                <label className="block text-sm font-medium t-body mb-1">Campus Name</label>
                <input required type="text" value={campusForm.name} onChange={e => setCampusForm({...campusForm, name: e.target.value})} className="w-full p-2 border border-line rounded focus:ring-brand focus:border-brand" placeholder="e.g. Main Campus" />
              </div>
              <div>
                <label className="block text-sm font-medium t-body mb-1">Campus Code</label>
                <input required type="text" value={campusForm.code} onChange={e => setCampusForm({...campusForm, code: e.target.value})} className="w-full p-2 border border-line rounded focus:ring-brand focus:border-brand" placeholder="e.g. MC" />
              </div>
              <div>
                <label className="block text-sm font-medium t-body mb-1">Address</label>
                <input type="text" value={campusForm.address} onChange={e => setCampusForm({...campusForm, address: e.target.value})} className="w-full p-2 border border-line rounded focus:ring-brand focus:border-brand" />
              </div>
              <div>
                <label className="block text-sm font-medium t-body mb-1">Contact Number</label>
                <input type="text" value={campusForm.contactNumber} onChange={e => setCampusForm({...campusForm, contactNumber: e.target.value})} className="w-full p-2 border border-line rounded focus:ring-brand focus:border-brand" />
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked={campusForm.isActive} onChange={e => setCampusForm({...campusForm, isActive: e.target.checked})} className="mr-2" id="campusActive" />
                <label htmlFor="campusActive" className="text-sm font-medium t-body">Is Active</label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-brand t-body font-bold py-2 px-4 rounded hover:bg-brand transition">{editingCampusId ? 'Update Campus' : 'Create Campus'}</button>
                {editingCampusId && (
                  <button type="button" onClick={resetCampusForm} className="px-4 py-2 rounded border border-line t-muted hover:bg-surface-2 transition">Cancel</button>
                )}
              </div>
            </form>
          </div>
          )}
          <div className={canWriteSettings ? 'md:col-span-2' : 'md:col-span-3'}>
            <div className="bg-solid rounded-xl shadow overflow-hidden border border-line">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium t-faint uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium t-faint uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium t-faint uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium t-faint uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-solid divide-y divide-line">
                  {localCampuses.map(campus => (
                    <tr key={campus._id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{campus.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{campus.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${campus.isActive ? 'bg-ok-soft t-ok' : 'bg-bad-soft t-bad'}`}>
                          {campus.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          {can('settings', 'edit') && (
                            <button onClick={() => handleEditCampus(campus)} className="px-3 py-1 text-xs font-medium t-warn bg-warn-soft hover:bg-warn-soft rounded transition">Edit</button>
                          )}
                          {can('settings', 'delete') && (
                            <button onClick={() => handleDeleteCampus(campus)} className="px-3 py-1 text-xs font-medium t-bad bg-bad-soft hover:bg-bad-soft rounded transition">Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {canWriteSettings && (
          <div className="md:col-span-1 bg-solid p-6 rounded-xl shadow border border-line">
            <h2 className="text-xl font-bold mb-4">{editingSessionId ? 'Edit Session' : 'Add New Session'}</h2>
            <form onSubmit={handleSaveSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium t-body mb-1">Session Name</label>
                <input required type="text" value={sessionForm.name} onChange={e => setSessionForm({...sessionForm, name: e.target.value})} className="w-full p-2 border border-line rounded focus:ring-brand focus:border-brand" placeholder="e.g. 2025-2026" />
              </div>
              <div>
                <label className="block text-sm font-medium t-body mb-1">Start Date</label>
                <input required type="date" value={sessionForm.startDate} onChange={e => setSessionForm({...sessionForm, startDate: e.target.value})} className="w-full p-2 border border-line rounded focus:ring-brand focus:border-brand" />
              </div>
              <div>
                <label className="block text-sm font-medium t-body mb-1">End Date</label>
                <input required type="date" value={sessionForm.endDate} onChange={e => setSessionForm({...sessionForm, endDate: e.target.value})} className="w-full p-2 border border-line rounded focus:ring-brand focus:border-brand" />
              </div>
              <div>
                <label className="block text-sm font-medium t-body mb-1">Status</label>
                <select value={sessionForm.status} onChange={e => setSessionForm({...sessionForm, status: e.target.value})} className="w-full p-2 border border-line rounded focus:ring-brand focus:border-brand">
                  <option value="Upcoming">Upcoming</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked={sessionForm.isActive} onChange={e => setSessionForm({...sessionForm, isActive: e.target.checked})} className="mr-2" id="sessionActive" />
                <label htmlFor="sessionActive" className="text-sm font-medium t-body">Set as Active Default</label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-brand t-body font-bold py-2 px-4 rounded hover:bg-brand transition">{editingSessionId ? 'Update Session' : 'Create Session'}</button>
                {editingSessionId && (
                  <button type="button" onClick={resetSessionForm} className="px-4 py-2 rounded border border-line t-muted hover:bg-surface-2 transition">Cancel</button>
                )}
              </div>
            </form>
          </div>
          )}
          <div className={canWriteSettings ? 'md:col-span-2' : 'md:col-span-3'}>
            <div className="bg-solid rounded-xl shadow overflow-hidden border border-line">
              <table className="min-w-full divide-y divide-line">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium t-faint uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium t-faint uppercase">Start - End</th>
                    <th className="px-6 py-3 text-left text-xs font-medium t-faint uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium t-faint uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-solid divide-y divide-line">
                  {localSessions.map(session => (
                    <tr key={session._id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium flex items-center">
                        {session.name}
                        {session.isActive && <span className="ml-2 px-2 py-0.5 text-xs bg-brand-soft t-brand rounded-full">Default</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm t-muted">
                        {new Date(session.startDate).toLocaleDateString()} - {new Date(session.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${session.status === 'Ongoing' ? 'bg-ok-soft t-ok' : 
                            session.status === 'Completed' ? 'bg-surface-2 t-body' : 
                            'bg-warn-soft t-warn'}`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          {can('settings', 'edit') && (
                            <button onClick={() => handleEditSession(session)} className="px-3 py-1 text-xs font-medium t-warn bg-warn-soft hover:bg-warn-soft rounded transition">Edit</button>
                          )}
                          {can('settings', 'delete') && (
                            <button onClick={() => handleDeleteSession(session)} className="px-3 py-1 text-xs font-medium t-bad bg-bad-soft hover:bg-bad-soft rounded transition">Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
