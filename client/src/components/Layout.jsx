import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard, Users, UserCog, DollarSign, FileText, BarChart2, LogOut,
  Menu, X, BookOpen, Settings, ChevronDown, Wallet, ArrowUpNarrowWide,
  Sun, Moon, Building2, CalendarDays,
} from 'lucide-react';
import toast from 'react-hot-toast';

// Grouped so a twelve-item sidebar reads as three short lists instead of one long
// scroll — the sections match how the office actually works (who is enrolled, what
// money moved, how the system is configured).
const navGroups = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Administrator', 'Staff'] },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/students', label: 'Students', icon: Users, roles: ['Admin', 'Administrator', 'Staff'] },
      { to: '/employees', label: 'Employees', icon: UserCog, roles: ['Admin', 'Administrator', 'Staff'] },
      { to: '/promotions', label: 'Promotions', icon: ArrowUpNarrowWide, roles: ['Admin', 'Administrator'] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/fees', label: 'Fee Management', icon: DollarSign, roles: ['Admin', 'Administrator', 'Staff'] },
      { to: '/challans', label: 'Challans', icon: FileText, roles: ['Admin', 'Administrator', 'Staff'] },
      { to: '/fee-structures', label: 'Fee Structures', icon: Wallet, roles: ['Admin', 'Administrator', 'Staff'] },
      { to: '/expenses', label: 'Expenses', icon: Wallet, roles: ['Admin', 'Administrator', 'Staff'] },
      { to: '/dues', label: 'Dues Report', icon: BarChart2, roles: ['Admin', 'Administrator'] },
      { to: '/reports', label: 'Reports', icon: BarChart2, roles: ['Admin', 'Administrator'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', label: 'Users', icon: Users, roles: ['Admin'] },
      { to: '/settings', label: 'System Settings', icon: Settings, roles: ['Admin'] },
    ],
  },
];

function ThemeToggle({ compact = false }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className={`icon-btn ${compact ? '' : 'p-2'}`}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

// The campus / session pickers. Wrapped so the icon sits inside the control and
// the native select arrow is replaced by one that follows the theme.
function ContextSelect({ icon: Icon, value, onChange, placeholder, children }) {
  return (
    <div className="relative flex items-center">
      <Icon size={13} className="absolute left-3 t-faint pointer-events-none" />
      <select
        value={value || ''}
        onChange={onChange}
        className="field appearance-none pl-8 pr-8 py-2 text-[11px] font-bold uppercase tracking-wider"
      >
        <option value="" disabled>{placeholder}</option>
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 t-faint pointer-events-none" />
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const {
    campuses, sessions,
    currentCampus, setCurrentCampus,
    currentSession, setCurrentSession,
  } = useAppContext();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const visibleGroups = navGroups
    .map(g => ({ ...g, items: g.items.filter(i => i.roles.includes(user?.role)) }))
    .filter(g => g.items.length > 0);

  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="flex h-screen font-sans overflow-hidden t-body">
      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-[width] duration-300 bg-surface backdrop-blur-xl border-r border-line flex flex-col z-20 flex-shrink-0`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-line">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--sms-primary) 0%, var(--sms-accent) 140%)',
              boxShadow: '0 6px 18px -6px var(--sms-primary)',
            }}
          >
            <BookOpen className="w-5 h-5" style={{ color: '#fff' }} />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden animate-fade-in">
              <p className="t-gradient font-extrabold text-sm tracking-wider uppercase leading-tight">School</p>
              <p className="t-muted text-[11px] font-semibold">Management Hub</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
          {visibleGroups.map(group => (
            <div key={group.label}>
              {sidebarOpen && (
                <p className="t-faint text-[9px] font-bold uppercase tracking-[0.12em] px-3 mb-1.5">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    title={sidebarOpen ? undefined : label}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 group ${
                        isActive ? 'nav-active' : 'nav-idle'
                      } ${sidebarOpen ? '' : 'justify-center'}`
                    }
                  >
                    <Icon size={17} className="flex-shrink-0" />
                    {sidebarOpen && (
                      <span className="text-[11px] font-bold tracking-wide uppercase truncate">{label}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-line p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 px-1 py-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--sms-primary) 0%, var(--sms-accent) 140%)', color: '#fff' }}
              >
                {initial}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="t-body text-xs font-bold truncate">{user?.name}</p>
                <p className="t-brand text-[10px] uppercase font-bold tracking-wider truncate">{user?.role}</p>
              </div>
              <button onClick={handleLogout} className="icon-btn icon-btn-danger" title="Log out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="icon-btn icon-btn-danger w-full py-2.5" title="Log out">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-surface backdrop-blur-xl border-b border-line px-5 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="icon-btn" title="Toggle sidebar">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="flex items-center gap-2.5 ml-1 flex-wrap">
            {/* Campus switching is Admin-only — everyone else is pinned to their
                own campus by the server regardless of what the client sends. */}
            {user?.role === 'Admin' && (
              <ContextSelect
                icon={Building2}
                value={currentCampus}
                onChange={(e) => setCurrentCampus(e.target.value)}
                placeholder="Select Campus"
              >
                {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </ContextSelect>
            )}

            <ContextSelect
              icon={CalendarDays}
              value={currentSession}
              onChange={(e) => setCurrentSession(e.target.value)}
              placeholder="Select Session"
            >
              {sessions.map(s => (
                <option key={s._id} value={s._id}>{s.name}{s.isActive ? ' •' : ''}</option>
              ))}
            </ContextSelect>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="flex items-center gap-2.5 surface-muted rounded-full px-3 py-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: 'linear-gradient(135deg, var(--sms-primary) 0%, var(--sms-accent) 140%)', color: '#fff' }}
              >
                {initial}
              </div>
              <span className="t-body text-xs font-semibold hidden sm:inline">{user?.name}</span>
              <span className="badge badge-brand text-[9px]">{user?.role}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
