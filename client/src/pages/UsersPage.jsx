import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, ShieldCheck, Users, ToggleLeft, Building2, CalendarDays, X, Lock,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { getUsers, createUser, updateUser, deleteUser } from '../api/users';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import ModalPortal from '../components/ModalPortal';
import PermissionMatrix from '../components/PermissionMatrix';
import ScopePicker from '../components/ScopePicker';
import { emptyGrid, summarizeGrid, PRESETS } from '../utils/permissions';

const SUPER_ADMIN_EMAIL = 'admin@school.com';

// Scope lists come back populated (objects) from the list endpoint and as plain
// ids from a save, so read both shapes.
const toIds = (list) => (list || []).map(v => (typeof v === 'string' ? v : v?._id)).filter(Boolean);

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // The permission grids and the two scope lists are held outside react-hook-form:
  // they are ticked structures, not input values, and the form only carries the
  // plain fields.
  const [grid, setGrid] = useState(emptyGrid);          // the default grid
  const [campusGrids, setCampusGrids] = useState({});   // { campusId: grid } overrides
  const [permTab, setPermTab] = useState('default');    // 'default' or a campus id
  const [campusScope, setCampusScope] = useState([]);
  const [sessionScope, setSessionScope] = useState([]);

  const { campuses, sessions } = useAppContext();
  const { user: me } = useAuth();
  const { register, handleSubmit, reset, watch } = useForm();

  // The Admin role is unrestricted by definition, so the grid and the scope
  // pickers are shown greyed out rather than pretending they would apply.
  const selectedRole = watch('role');
  const isAdminRole = selectedRole === 'Admin';
  const editingSuperAdmin = editingUser?.email === SUPER_ADMIN_EMAIL;

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
        isActive: user.isActive,
      });
      // The server sends the resolved grid, so an account that predates
      // permissions opens showing what it can actually do today rather than blank.
      setGrid(user.permissions || emptyGrid());
      setCampusGrids(user.campusPermissions || {});
      setCampusScope(toIds(user.campusScope));
      setSessionScope(toIds(user.sessionScope));
    } else {
      reset({ name: '', email: '', password: '', role: 'Staff', isActive: true });
      // A new account starts from the Office Staff preset — a sensible day-to-day
      // set the admin can trim, rather than an empty grid that logs in to nothing.
      setGrid(PRESETS.find(p => p.key === 'staff').build());
      setCampusGrids({});
      setCampusScope([]);
      setSessionScope([]);
    }
    setPermTab('default');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    reset();
  };

  // The campuses the per-campus tabs are offered for: the ones this account is
  // scoped to, or every campus when it may work anywhere.
  const tabCampuses = useMemo(
    () => (campusScope.length > 0 ? campuses.filter(c => campusScope.includes(c._id)) : campuses),
    [campusScope, campuses]
  );

  // Unticking a campus must take its override with it, or a grid would sit
  // invisible in the record waiting to surprise someone if that campus is added
  // back. The server drops them on save too; this keeps the form honest first.
  useEffect(() => {
    if (campusScope.length === 0) return;
    const stale = Object.keys(campusGrids).filter(id => !campusScope.includes(id));
    if (stale.length === 0) return;

    setCampusGrids(prev => {
      const next = { ...prev };
      stale.forEach(id => delete next[id]);
      return next;
    });
    if (stale.includes(permTab)) setPermTab('default');
  }, [campusScope, campusGrids, permTab]);

  const hasOverride = (campusId) => !!campusGrids[campusId];

  // Start a campus off from the default it is currently following, so the admin
  // trims from a working set rather than building one from nothing.
  const addOverride = (campusId) => {
    setCampusGrids(prev => ({ ...prev, [campusId]: JSON.parse(JSON.stringify(grid)) }));
  };

  const removeOverride = (campusId) => {
    setCampusGrids(prev => {
      const next = { ...prev };
      delete next[campusId];
      return next;
    });
  };

  const onSubmit = async (data) => {
    const payload = {
      ...data,
      permissions: grid,
      campusPermissions: campusGrids,
      campusScope,
      sessionScope,
      // The account's default campus follows its scope: the first allowed one, or
      // none at all when it may work across every campus.
      campus: campusScope[0] || '',
    };

    try {
      if (editingUser) {
        if (!payload.password) delete payload.password;
        await updateUser(editingUser._id, payload);
        toast.success('User updated successfully');
      } else {
        if (!payload.password) return toast.error('Password is required for new users');
        await createUser(payload);
        toast.success('User created successfully');
      }
      closeModal();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const handleDelete = async (user) => {
    if (window.confirm(`Delete ${user.name}? They will lose access immediately.`)) {
      try {
        await deleteUser(user._id);
        toast.success('User deleted');
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Delete failed');
      }
    }
  };

  const scopeLabel = (user, key, all) => {
    const raw = user[key] || [];
    if (raw.length === 0) return all;

    // The list endpoint populates these, so prefer the name that came with the
    // record — a campus that has since been deactivated is missing from the
    // context lists but should still be named here rather than shown as a count.
    const source = key === 'campusScope' ? campuses : sessions;
    const names = raw
      .map(v => (typeof v === 'object' && v?.name) ? v.name : source.find(o => o._id === v)?.name)
      .filter(Boolean);

    if (names.length === 0) return `${raw.length} selected`;
    return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
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
  const restrictedCount = useMemo(
    () => users.filter(u => toIds(u.campusScope).length > 0 || toIds(u.sessionScope).length > 0).length,
    [users]
  );

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
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold t-body tracking-tight uppercase">User Management</h1>
          <p className="t-muted text-xs font-semibold mt-1 uppercase tracking-wider">
            Set who can open which screens, what they may change, and which campuses and sessions they work in
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="btn btn-primary self-start md:self-auto"
        >
          <Plus size={16} /> Create User
        </button>
      </div>

      {/* Screen Analytics: User Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-blue-600/80 to-blue-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Users className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Total Accounts</p>
            <p className="text-xl sm:text-2xl font-extrabold t-brand mt-0.5 tracking-tight break-words">{users.length} registered</p>
            <p className="t-faint text-xs mt-1 font-medium">{activeCount} active user sessions</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-purple-600/80 to-purple-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <ShieldCheck className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Admins / Managers</p>
            <p className="text-xl sm:text-2xl font-extrabold t-brand mt-0.5 tracking-tight break-words">{roleBreakdown.Admin + roleBreakdown.Administrator} users</p>
            <p className="t-faint text-xs mt-1 font-medium">{roleBreakdown.Admin} Super Admins • {roleBreakdown.Administrator} Admins</p>
          </div>
        </div>

        <div className="card card-lg p-5 flex items-start gap-4">
          <div className="bg-gradient-to-tr from-emerald-600/80 to-emerald-400/80 rounded-xl p-3 flex-shrink-0 shadow-md">
            <Lock className="t-body w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="t-muted text-[10px] font-bold uppercase tracking-wider">Scoped Accounts</p>
            <p className="text-xl sm:text-2xl font-extrabold t-ok mt-0.5 tracking-tight break-words">{restrictedCount} restricted</p>
            <p className="t-faint text-xs mt-1 font-medium">Limited to specific campuses or sessions</p>
          </div>
        </div>
      </div>

      {/* Grid table */}
      <div className="card card-lg overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-xs text-left rtable">
            <thead className="bg-surface-2 border-b border-line t-muted uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-5 py-4">Name</th>
                <th className="px-5 py-4">Email</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Access Granted</th>
                <th className="px-5 py-4">Campus / Session Scope</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line t-muted">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-surface-2 transition group">
                  <td data-label="Name" className="px-5 py-4 font-bold t-body md:whitespace-nowrap">{u.name}</td>
                  <td data-label="Email" className="px-5 py-4 t-muted font-medium font-mono break-all">{u.email}</td>
                  <td data-label="Role" className="px-5 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                      u.role === 'Admin' ? 'bg-brand-soft t-brand border-brand-border' :
                      u.role === 'Administrator' ? 'bg-brand-soft t-brand border-brand-border' :
                      'bg-surface-3 t-muted border-line'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td data-label="Access Granted" className="px-5 py-4 t-muted font-medium md:max-w-56">
                    <div>
                      {summarizeGrid(u)}
                      {/* A per-campus grid replaces the default at that campus, so
                          the summary above is not the whole story for this account. */}
                      {Object.keys(u.campusPermissions || {}).length > 0 && (
                        <span className="block mt-1 text-[10px] font-bold uppercase tracking-wider t-ok">
                          Different at {Object.keys(u.campusPermissions).length} campus
                          {Object.keys(u.campusPermissions).length > 1 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Campus / Session" className="px-5 py-4 t-muted font-medium">
                    <div>
                      <span className="flex items-center gap-1.5 md:justify-start justify-end">
                        <Building2 size={11} className="t-faint flex-shrink-0" />
                        {scopeLabel(u, 'campusScope', 'All campuses')}
                      </span>
                      <span className="flex items-center gap-1.5 mt-1 md:justify-start justify-end">
                        <CalendarDays size={11} className="t-faint flex-shrink-0" />
                        {scopeLabel(u, 'sessionScope', 'All sessions')}
                      </span>
                    </div>
                  </td>
                  <td data-label="Status" className="px-5 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${u.isActive ? 'bg-ok-soft t-ok border-ok-border' : 'bg-bad-soft t-bad border-bad-border'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td data-actions="" className="px-5 py-4">
                    <div className="row-actions">
                      <button onClick={() => openModal(u)} className="p-1.5 t-muted hover:t-brand hover:bg-brand-soft border border-transparent hover:border-brand-border rounded-xl transition" title="Edit access">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-1.5 t-muted hover:t-bad hover:bg-bad-soft border border-transparent hover:border-bad-border rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={u.email === SUPER_ADMIN_EMAIL || u._id === me?._id}
                        title={u.email === SUPER_ADMIN_EMAIL ? 'The main admin cannot be deleted' : 'Delete user'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr className="row-plain">
                  <td colSpan="7" className="p-12 text-center t-faint font-medium">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <ModalPortal>
          <div className="modal-shell">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={closeModal} />
            <div className="card card-lg modal-box sm:max-w-4xl animate-fade-in-up">
              <div className="px-5 sm:px-6 py-4 border-b border-line bg-surface-2 flex justify-between items-center gap-3 flex-shrink-0">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider t-body">
                    {editingUser ? `Edit Access — ${editingUser.name}` : 'Create System Account'}
                  </h2>
                  <p className="t-faint text-[10px] font-semibold uppercase tracking-wider mt-0.5">
                    Only you, as Admin, can set these
                  </p>
                </div>
                <button onClick={closeModal} className="icon-btn flex-shrink-0" aria-label="Close"><X size={20} /></button>
              </div>

              <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="p-5 sm:p-6 space-y-5 overflow-y-auto">
                {/* Account details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div>
                    <label className="block text-[10px] font-bold t-muted uppercase tracking-widest mb-1.5">System Role</label>
                    <select
                      {...register('role')}
                      disabled={editingSuperAdmin}
                      className="w-full text-xs font-semibold bg-surface-2 border border-line rounded-xl px-3 py-2.5 t-body outline-none focus:ring-2 focus:ring-brand cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="Admin" className="bg-surface-2">Admin — full access, manages users</option>
                      <option value="Administrator" className="bg-surface-2">Administrator — access below</option>
                      <option value="Staff" className="bg-surface-2">Staff — access below</option>
                    </select>
                  </div>
                </div>

                {/* The hint drops to its own line on a phone rather than
                    squeezing the label it belongs to into two words a line. */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <input
                    type="checkbox" id="isActive" {...register('isActive')}
                    disabled={editingSuperAdmin}
                    className="rounded border-line bg-surface-2 t-brand focus:ring-brand cursor-pointer w-4 h-4 flex-shrink-0 disabled:opacity-50"
                  />
                  <label htmlFor="isActive" className="text-xs t-muted font-bold uppercase tracking-wider cursor-pointer">
                    Account is Active
                  </label>
                  <span className="t-faint text-[10px] font-medium w-full sm:w-auto">An inactive account cannot log in at all.</span>
                </div>

                {isAdminRole && (
                  <div className="note note-brand flex items-start gap-2.5">
                    <ShieldCheck size={15} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Admin has unrestricted access</strong> to every screen, every campus and every session,
                      and is the only role that can manage user accounts. Choose Administrator or Staff to hand out
                      specific access instead.
                    </span>
                  </div>
                )}

                {/* Permissions */}
                <div className="pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
                    <h3 className="text-[11px] font-bold t-body uppercase tracking-widest">What this user can do</h3>
                    <span className="t-faint text-[10px] font-medium">
                      Ticking a write box turns View on — you cannot change what you cannot open
                    </span>
                  </div>

                  {/* Per-campus tabs. The same person may run the office at one
                      campus and only collect fees at another, so each campus can
                      carry its own grid; the Default tab covers every campus that
                      is not given one of its own. */}
                  {!isAdminRole && tabCampuses.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-3 border-b border-line pb-2">
                      <button
                        type="button"
                        onClick={() => setPermTab('default')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition border ${
                          permTab === 'default'
                            ? 'bg-brand-soft t-brand border-brand-border'
                            : 'bg-surface-2 t-muted border-line hover:t-brand'
                        }`}
                      >
                        Default {campusScope.length === 0 ? '(all campuses)' : '(unlisted campuses)'}
                      </button>

                      {tabCampuses.map(c => (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => setPermTab(c._id)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition border flex items-center gap-1.5 ${
                            permTab === c._id
                              ? 'bg-brand-soft t-brand border-brand-border'
                              : 'bg-surface-2 t-muted border-line hover:t-brand'
                          }`}
                        >
                          <Building2 size={11} />
                          {c.name}
                          {hasOverride(c._id) && (
                            <span className="px-1.5 py-0.5 rounded-full bg-ok-soft t-ok border border-ok-border text-[8px]">
                              Custom
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {permTab === 'default' || isAdminRole ? (
                    <PermissionMatrix grid={grid} onChange={setGrid} disabled={isAdminRole} />
                  ) : hasOverride(permTab) ? (
                    <>
                      <div className="note note-info flex flex-col sm:flex-row items-start sm:justify-between gap-3 mb-3">
                        <span>
                          These rights apply <strong>only at {campuses.find(c => c._id === permTab)?.name}</strong>.
                          They replace the default entirely — what is unticked here is not allowed here, even if
                          the default allows it.
                        </span>
                        <button
                          type="button"
                          onClick={() => removeOverride(permTab)}
                          className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider t-bad hover:underline"
                        >
                          Use default instead
                        </button>
                      </div>
                      <PermissionMatrix
                        grid={campusGrids[permTab]}
                        onChange={(g) => setCampusGrids(prev => ({ ...prev, [permTab]: g }))}
                      />
                    </>
                  ) : (
                    <div className="note note-brand flex flex-col items-start gap-3">
                      <span>
                        <strong>{campuses.find(c => c._id === permTab)?.name}</strong> currently uses the default
                        access shown on the Default tab. Give it its own set if this user should do more — or
                        less — at this campus than elsewhere.
                      </span>
                      <button
                        type="button"
                        onClick={() => addOverride(permTab)}
                        className="btn btn-primary"
                      >
                        <Plus size={14} /> Set different access for this campus
                      </button>
                    </div>
                  )}
                </div>

                {/* Data scope */}
                <div className="pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
                    <h3 className="text-[11px] font-bold t-body uppercase tracking-widest">What data this user can see</h3>
                    <span className="t-faint text-[10px] font-medium">
                      Everything on every screen is filtered to these
                    </span>
                  </div>
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${isAdminRole ? 'opacity-50 pointer-events-none' : ''}`}>
                    <ScopePicker
                      label="Campus Access"
                      icon={Building2}
                      allLabel="All campuses"
                      options={campuses}
                      selected={campusScope}
                      onChange={setCampusScope}
                      hint="Pick one or more to lock this user to them. Records from any other campus stay invisible."
                    />
                    <ScopePicker
                      label="Session Access"
                      icon={CalendarDays}
                      allLabel="All sessions"
                      options={sessions}
                      selected={sessionScope}
                      onChange={setSessionScope}
                      hint="Useful for keeping a user in the current year only, with no access to past sessions."
                    />
                  </div>
                </div>
              </form>

              <div className="px-5 sm:px-6 py-4 border-t border-line bg-surface-2 modal-actions flex-shrink-0">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider t-muted hover:bg-surface-3 border border-line rounded-xl transition">
                  Cancel
                </button>
                <button type="submit" form="user-form" className="btn btn-primary">
                  {editingUser ? 'Save Access' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
