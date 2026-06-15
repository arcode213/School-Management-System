import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, UserCog, DollarSign,
  FileText, BarChart2, LogOut, Menu, X, BookOpen, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Teacher', 'Accountant'] },
  { to: '/students', label: 'Students', icon: Users, roles: ['Admin', 'Teacher', 'Accountant'] },
  { to: '/employees', label: 'Employees', icon: UserCog, roles: ['Admin'] },
  { to: '/fees', label: 'Fee Management', icon: DollarSign, roles: ['Admin', 'Accountant'] },
  { to: '/challans', label: 'Challans', icon: FileText, roles: ['Admin', 'Accountant'] },
  { to: '/dues', label: 'Dues Report', icon: BarChart2, roles: ['Admin', 'Accountant'] },
  { to: '/reports', label: 'Reports', icon: BarChart2, roles: ['Admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const filteredNav = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-slate-900 flex flex-col shadow-2xl z-20 flex-shrink-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <BookOpen className="text-white w-5 h-5" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-white font-bold text-sm leading-tight">School</p>
              <p className="text-blue-300 text-xs">Management System</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {filteredNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={20} className="flex-shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-slate-700 p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.name?.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
                <p className="text-slate-400 text-xs truncate">{user?.role}</p>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center text-slate-400 hover:text-red-400 transition py-2">
              <LogOut size={20} />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4 shadow-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-slate-900 transition"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 bg-slate-100 rounded-full px-3 py-1.5">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0)}
            </div>
            <span className="text-sm text-slate-700 font-medium">{user?.name}</span>
            <span className="text-xs text-slate-400 bg-slate-200 rounded-full px-2 py-0.5">{user?.role}</span>
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
