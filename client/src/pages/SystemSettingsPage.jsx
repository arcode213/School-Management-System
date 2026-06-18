import { useState, useEffect } from 'react';
import api from '../api/axios';
import { toast } from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';

export default function SystemSettingsPage() {
  const { campuses, sessions, setCurrentCampus, setCurrentSession } = useAppContext();
  
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

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">System Settings</h1>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-gray-200">
        <button
          className={`py-2 px-4 font-semibold ${activeTab === 'campuses' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('campuses')}
        >
          Campuses
        </button>
        <button
          className={`py-2 px-4 font-semibold ${activeTab === 'sessions' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('sessions')}
        >
          Academic Sessions
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : activeTab === 'campuses' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-xl shadow border border-gray-100">
            <h2 className="text-xl font-bold mb-4">{editingCampusId ? 'Edit Campus' : 'Add New Campus'}</h2>
            <form onSubmit={handleSaveCampus} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campus Name</label>
                <input required type="text" value={campusForm.name} onChange={e => setCampusForm({...campusForm, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. Main Campus" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campus Code</label>
                <input required type="text" value={campusForm.code} onChange={e => setCampusForm({...campusForm, code: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. MC" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={campusForm.address} onChange={e => setCampusForm({...campusForm, address: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                <input type="text" value={campusForm.contactNumber} onChange={e => setCampusForm({...campusForm, contactNumber: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked={campusForm.isActive} onChange={e => setCampusForm({...campusForm, isActive: e.target.checked})} className="mr-2" id="campusActive" />
                <label htmlFor="campusActive" className="text-sm font-medium text-gray-700">Is Active</label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition">{editingCampusId ? 'Update Campus' : 'Create Campus'}</button>
                {editingCampusId && (
                  <button type="button" onClick={resetCampusForm} className="px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                )}
              </div>
            </form>
          </div>
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {localCampuses.map(campus => (
                    <tr key={campus._id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{campus.code}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{campus.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${campus.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {campus.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEditCampus(campus)} className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded transition">Edit</button>
                          <button onClick={() => handleDeleteCampus(campus)} className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded transition">Delete</button>
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
          <div className="md:col-span-1 bg-white p-6 rounded-xl shadow border border-gray-100">
            <h2 className="text-xl font-bold mb-4">{editingSessionId ? 'Edit Session' : 'Add New Session'}</h2>
            <form onSubmit={handleSaveSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session Name</label>
                <input required type="text" value={sessionForm.name} onChange={e => setSessionForm({...sessionForm, name: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" placeholder="e.g. 2025-2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input required type="date" value={sessionForm.startDate} onChange={e => setSessionForm({...sessionForm, startDate: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input required type="date" value={sessionForm.endDate} onChange={e => setSessionForm({...sessionForm, endDate: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={sessionForm.status} onChange={e => setSessionForm({...sessionForm, status: e.target.value})} className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                  <option value="Upcoming">Upcoming</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked={sessionForm.isActive} onChange={e => setSessionForm({...sessionForm, isActive: e.target.checked})} className="mr-2" id="sessionActive" />
                <label htmlFor="sessionActive" className="text-sm font-medium text-gray-700">Set as Active Default</label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition">{editingSessionId ? 'Update Session' : 'Create Session'}</button>
                {editingSessionId && (
                  <button type="button" onClick={resetSessionForm} className="px-4 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                )}
              </div>
            </form>
          </div>
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start - End</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {localSessions.map(session => (
                    <tr key={session._id}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium flex items-center">
                        {session.name}
                        {session.isActive && <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">Default</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(session.startDate).toLocaleDateString()} - {new Date(session.endDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${session.status === 'Ongoing' ? 'bg-green-100 text-green-800' : 
                            session.status === 'Completed' ? 'bg-gray-100 text-gray-800' : 
                            'bg-yellow-100 text-yellow-800'}`}>
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEditSession(session)} className="px-3 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded transition">Edit</button>
                          <button onClick={() => handleDeleteSession(session)} className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded transition">Delete</button>
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
