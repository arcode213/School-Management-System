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
      <div className="flex flex-col items-center justify-center h-64 t-muted">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        <p className="text-xs uppercase font-bold tracking-wider mt-3">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold t-body tracking-tight uppercase">User Management</h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">Manage administrative roles, credentials, and campus permissions</p>
        </div>
        <button
          onClick={() => openModal()}
          className="btn btn-primary self-start md:self-auto"
        >
          <Plus size={16} /> Create User
        </button>
      </div>

      {/* Screen Analytics: User Summary Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Users className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Total Accounts</p>
            <p className="text-2xl font-extrabold t-brand mt-0.5 tracking-tight">{users.length} registered</p>
            <p className="t-faint text-xs mt-1 font-medium">{activeCount} active user sessions</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <ShieldCheck className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Admins / Managers</p>
            <p className="text-2xl font-extrabold t-brand mt-0.5 tracking-tight">{roleBreakdown.Admin + roleBreakdown.Administrator} users</p>
            <p className="t-faint text-xs mt-1 font-medium">{roleBreakdown.Admin} Super Admins • {roleBreakdown.Administrator} Admins</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <ToggleLeft className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Staff Members</p>
            <p className="text-2xl font-extrabold t-ok mt-0.5 tracking-tight">{roleBreakdown.Staff} accounts</p>
            <p className="t-faint text-xs mt-1 font-medium">Standard campus cashiers &amp; support</p>
          </div>
        </div>
      </div>

      {/* Grid table */}
      <div className="card card-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Campus Scope</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line t-muted">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-surface-2 transition group">
                  <td className="px-5 py-4 font-bold t-body whitespace-nowrap">{u.name}</td>
                  <td className="px-5 py-4 t-muted font-medium font-mono">{u.email}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                      u.role === 'Admin' ? 'bg-brand-soft t-brand border-brand-border' :
                      u.role === 'Administrator' ? 'bg-brand-soft t-brand border-brand-border' :
                      'bg-surface-3 t-muted border-line'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 t-muted font-medium">{u.campus?.name || 'All Campuses'}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${u.isActive ? 'bg-ok-soft t-ok border-ok-border' : 'bg-bad-soft t-bad border-bad-border'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition duration-150">
                      <button onClick={() => openModal(u)} className="p-1.5 t-muted hover:t-brand hover:bg-brand-soft border border-transparent hover:border-brand-border rounded-xl transition" title="Edit Settings">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(u._id)} className="p-1.5 t-muted hover:t-bad hover:bg-bad-soft border border-transparent hover:border-bad-border rounded-xl transition" disabled={u.email === 'admin@school.com'} title="Delete User">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-12 text-center t-faint font-medium">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card card-lg w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="px-6 py-4 border-b border-line bg-surface-2 flex justify-between items-center">
              <h2 className="text-sm font-bold uppercase tracking-wider t-body">{editingUser ? 'Edit User Settings' : 'Create System Account'}</h2>
              <button onClick={closeModal} className="t-muted hover:t-body"><Plus size={24} className="rotate-45" /></button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Full Name</label>
                <input {...register('name', { required: true })} className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Email Address</label>
                <input type="email" {...register('email', { required: true })} className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>

              <div>
                <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">
                  Password {editingUser && <span className="t-faint font-normal lowercase">(leave blank to keep unchanged)</span>}
                </label>
                <input type="password" {...register('password')} className="w-full text-xs bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">System Role</label>
                  <select {...register('role')} className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body outline-none focus:ring-2 focus:ring-brand cursor-pointer">
                    <option value="Admin" className="bg-surface-2">Admin</option>
                    <option value="Administrator" className="bg-surface-2">Administrator</option>
                    <option value="Staff" className="bg-surface-2">Staff</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">Campus Scope</label>
                  <select {...register('campus')} className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body outline-none focus:ring-2 focus:ring-brand cursor-pointer">
                    <option value="" className="bg-surface-2">None (All Campuses)</option>
                    {campuses.map(c => (
                      <option key={c._id} value={c._id} className="bg-surface-2">{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input type="checkbox" id="isActive" {...register('isActive')} className="rounded border-line bg-surface-2 t-brand focus:ring-brand cursor-pointer w-4 h-4" />
                <label htmlFor="isActive" className="text-xs t-muted font-bold uppercase tracking-wider cursor-pointer">Account is Active</label>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-line">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-xs font-bold uppercase tracking-wider t-muted hover:bg-surface-2 rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
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
