import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, Users, ToggleLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { getUsers, createUser, updateUser, deleteUser } from '../api/users';
import { useAppContext } from '../context/AppContext';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const { campuses } = useAppContext();
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (user = null) => {
    setEditingUser(user);
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        role: user.role,
        campus: user.campus?._id || '',
        isActive: user.isActive,
      });
    } else {
      reset({ name: '', email: '', password: '', role: 'Staff', campus: '', isActive: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    reset();
  };

  const onSubmit = async (data) => {
    try {
      if (editingUser) {
        if (!data.password) delete data.password;
        await updateUser(editingUser._id, data);
        toast.success('User updated successfully');
      } else {
        if (!data.password) return toast.error('Password is required for new users');
        await createUser(data);
        toast.success('User created successfully');
      }
      closeModal();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteUser(id);
        toast.success('User deleted');
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Delete failed');
      }
    }
  };

  // Derived Analytics Metrics
  const activeCount = useMemo(() => users.filter(u => u.isActive).length, [users]);
  const roleBreakdown = useMemo(() => {
    const counts = { Admin: 0, Administrator: 0, Staff: 0 };
    users.forEach(u => {
      if (counts[u.role] !== undefined) counts[u.role]++;
    });
    return counts;
  }, [users]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-xs uppercase font-bold tracking-wider mt-3">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">User Management</h1>
          <p className="text-slate-400 text-xs font-semibold mt-1 uppercase tracking-wider">Manage administrative roles, credentials, and campus permissions</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl px-4 py-2.5 transition shadow-lg shadow-blue-500/25 active:scale-95 self-start md:self-auto"
        >
          <Plus size={16} /> Create User
        </button>
      </div>

      {/* Screen Analytics: User Summary Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Users className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Accounts</p>
            <p className="text-2xl font-extrabold text-blue-400 mt-0.5 tracking-tight">{users.length} registered</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">{activeCount} active user sessions</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <ShieldCheck className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Admins / Managers</p>
            <p className="text-2xl font-extrabold text-purple-400 mt-0.5 tracking-tight">{roleBreakdown.Admin + roleBreakdown.Administrator} users</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">{roleBreakdown.Admin} Super Admins • {roleBreakdown.Administrator} Admins</p>
          </div>
        </div>

        <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 flex items-start gap-4 shadow-xl">
          <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <ToggleLeft className="text-white w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Staff Members</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-0.5 tracking-tight">{roleBreakdown.Staff} accounts</p>
            <p className="text-slate-500 text-xs mt-1 font-medium">Standard campus cashiers &amp; support</p>
          </div>
        </div>
      </div>

      {/* Grid table */}
      <div className="bg-[#111827]/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-white/3 border-b border-white/5 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Campus Scope</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/3 text-slate-300">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-white/3 transition group">
                  <td className="px-5 py-4 font-bold text-white whitespace-nowrap">{u.name}</td>
                  <td className="px-5 py-4 text-slate-300 font-medium font-mono">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                      u.role === 'Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      u.role === 'Administrator' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-400 font-medium">{u.campus?.name || 'All Campuses'}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${u.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150">
                      <button onClick={() => openModal(u)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 rounded-xl transition" title="Edit Settings">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(u._id)} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition" disabled={u.email === 'admin@school.com'} title="Delete User">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-500 font-medium">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#080c14]/65 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-white/5 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-white/5 bg-white/3 flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">{editingUser ? 'Edit User Settings' : 'Create System Account'}</h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-200"><Plus size={24} className="rotate-45" /></button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                <input {...register('name', { required: true })} className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                <input type="email" {...register('email', { required: true })} className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Password {editingUser && <span className="text-slate-500 font-normal lowercase">(leave blank to keep unchanged)</span>}
                </label>
                <input type="password" {...register('password')} className="w-full text-xs bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">System Role</label>
                  <select {...register('role')} className="w-full text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                    <option value="Admin" className="bg-slate-900">Admin</option>
                    <option value="Administrator" className="bg-slate-900">Administrator</option>
                    <option value="Staff" className="bg-slate-900">Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Campus Scope</label>
                  <select {...register('campus')} className="w-full text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                    <option value="" className="bg-slate-900">None (All Campuses)</option>
                    {campuses.map(c => (
                      <option key={c._id} value={c._id} className="bg-slate-900">{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input type="checkbox" id="isActive" {...register('isActive')} className="rounded border-white/10 bg-slate-900 text-blue-500 focus:ring-blue-500 cursor-pointer w-4 h-4" />
                <label htmlFor="isActive" className="text-xs text-slate-300 font-bold uppercase tracking-wider cursor-pointer">Account is Active</label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/5 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-blue-500/25">
                  {editingUser ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
