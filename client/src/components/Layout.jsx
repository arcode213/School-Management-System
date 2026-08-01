import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import {
  LayoutDashboard, Users, UserCog, DollarSign,
  FileText, BarChart2, LogOut, Menu, X, BookOpen, Settings, ChevronDown, Wallet
} from 'lucide-react';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Administrator', 'Staff'] },
  { to: '/students', label: 'Students', icon: Users, roles: ['Admin', 'Administrator', 'Staff'] },
  { to: '/employees', label: 'Employees', icon: UserCog, roles: ['Admin', 'Administrator', 'Staff'] },
  { to: '/promotions', label: 'Promotions', icon: Users, roles: ['Admin', 'Administrator'] },
  { to: '/expenses', label: 'Expenses', icon: Wallet, roles: ['Admin', 'Administrator', 'Staff'] },
  { to: '/fee-structures', label: 'Fee Structures', icon: Settings, roles: ['Admin', 'Administrator', 'Staff'] },
  { to: '/fees', label: 'Fee Management', icon: DollarSign, roles: ['Admin', 'Administrator', 'Staff'] },
  { to: '/challans', label: 'Challans', icon: FileText, roles: ['Admin', 'Administrator', 'Staff'] },
  { to: '/dues', label: 'Dues Report', icon: BarChart2, roles: ['Admin', 'Administrator'] },
  { to: '/reports', label: 'Reports', icon: BarChart2, roles: ['Admin', 'Administrator'] },
  { to: '/users', label: 'Users', icon: Users, roles: ['Admin'] },
  { to: '/settings', label: 'System Settings', icon: Settings, roles: ['Admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { 
    campuses, sessions, 
    currentCampus, setCurrentCampus, 
    currentSession, setCurrentSession 
  } = useAppContext();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const filteredNav = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#0b0f19] via-[#111827] to-[#0b0f19] font-sans overflow-hidden text-slate-100">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-[#090d16]/80 backdrop-blur-xl border-r border-white/5 flex flex-col shadow-[10px_0_30px_rgba(0,0,0,0.5)] z-20 flex-shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <BookOpen className="text-white w-5 h-5" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden animate-fade-in-up">
              <p className="text-white font-extrabold text-sm tracking-wider uppercase bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">School</p>
              <p className="text-blue-400 text-xs font-semibold">Management Hub</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
          {filteredNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/20 to-indigo-600/10 text-white font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border-l-4 border-blue-500'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
              {sidebarOpen && <span className="text-xs font-semibold tracking-wide uppercase">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-white/5 p-4 bg-black/10">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                {user?.name?.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-white text-xs font-bold truncate">{user?.name}</p>
                <p className="text-blue-400 text-[10px] uppercase font-bold tracking-wider truncate">{user?.role}</p>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-xl transition">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-xl transition py-2.5">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-[#090d16]/40 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center gap-4 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-400 hover:text-slate-100 hover:bg-white/5 p-2 rounded-xl transition"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          
          <div className="flex items-center gap-3 ml-4">
            {/* Campus Switcher - Only visible to Admin */}
            {user?.role === 'Admin' && (
              <div className="relative">
                <select
                  value={currentCampus || ''}
                  onChange={(e) => setCurrentCampus(e.target.value)}
                  className="appearance-none bg-slate-900/60 border border-white/10 text-xs text-slate-200 rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer font-semibold uppercase tracking-wider"
                >
                  <option value="" disabled>Select Campus</option>
                  {campuses.map(c => (
                    <option key={c._id} value={c._id} className="bg-slate-900 text-slate-200">{c.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}

            {/* Session Switcher */}
            <div className="relative">
              <select
                value={currentSession || ''}
                onChange={(e) => setCurrentSession(e.target.value)}
                className="appearance-none bg-slate-900/60 border border-white/10 text-xs text-slate-200 rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer font-semibold uppercase tracking-wider"
              >
                <option value="" disabled>Select Session</option>
                {sessions.map(s => (
                  <option key={s._id} value={s._id} className="bg-slate-900 text-slate-200">
                    {s.name} {s.isActive ? '●' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex-1" />
          <div className="flex items-center gap-2.5 bg-slate-900/60 border border-white/5 rounded-full px-3.5 py-1.5 shadow-sm">
            <div className="w-6 h-6 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-[0_0_8px_rgba(59,130,246,0.4)]">
              {user?.name?.charAt(0)}
            </div>
            <span className="text-xs text-slate-200 font-semibold">{user?.name}</span>
            <span className="text-[9px] text-blue-300 bg-blue-500/10 border border-blue-500/20 uppercase tracking-widest font-bold rounded-full px-2 py-0.5">{user?.role}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
