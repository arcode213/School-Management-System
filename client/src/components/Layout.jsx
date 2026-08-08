import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import {
  LogOut, Menu, X, BookOpen, ChevronDown,
  Sun, Moon, Building2, CalendarDays, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { visibleNavGroups } from '../utils/navigation';
import { useIsDesktop } from '../utils/useMediaQuery';

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
    <div className="relative flex items-center min-w-0 flex-1 sm:flex-none">
      <Icon size={13} className="absolute left-3 t-faint pointer-events-none" />
      <select
        value={value || ''}
        onChange={onChange}
        className="field appearance-none pl-8 pr-8 py-2 text-[11px] font-bold uppercase tracking-wider w-full sm:w-auto sm:max-w-[13rem] truncate"
      >
        <option value="" disabled>{placeholder}</option>
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 t-faint pointer-events-none" />
    </div>
  );
}

export default function Layout() {
  const { user, logout, can } = useAuth();
  const {
    campuses, sessions,
    currentCampus, setCurrentCampus,
    currentSession, setCurrentSession,
  } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();

  // On a laptop this is "is the rail expanded or collapsed to icons"; on a phone
  // or tablet the same flag is "is the drawer open", and it starts closed there
  // because a drawer covering the screen is not a sensible landing state.
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);

  // Crossing the breakpoint has to reset the flag, or a drawer left open on a
  // phone becomes a permanently collapsed rail once the device is turned.
  useEffect(() => { setSidebarOpen(isDesktop); }, [isDesktop]);

  // Picking a screen from the drawer should reveal it, not leave the drawer over
  // the top of it. On a laptop the rail is not covering anything, so it stays.
  useEffect(() => {
    if (!isDesktop) setSidebarOpen(false);
  }, [location.pathname, isDesktop]);

  // A drawer over the page must not let the page behind it scroll away.
  useEffect(() => {
    if (isDesktop || !sidebarOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isDesktop, sidebarOpen]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Drawn from what this account was granted, so the sidebar only ever offers
  // screens it can actually open.
  const visibleGroups = visibleNavGroups(user, can);

  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';

  // Labels are shown whenever there is room for them: always in the drawer (it is
  // full width when open), and on a laptop only while the rail is expanded.
  const showLabels = !isDesktop || sidebarOpen;

  return (
    <div className="flex h-[100dvh] font-sans overflow-hidden t-body">
      {/* Drawer scrim — only below lg, where the sidebar sits over the page. */}
      {!isDesktop && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────
          Below lg it is a fixed drawer that slides in over the page; from lg up
          it is an in-flow column that toggles between labelled and icon-only. */}
      <aside
        className={`
          bg-surface backdrop-blur-xl border-r border-line flex flex-col flex-shrink-0
          fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:z-20 lg:translate-x-0 lg:max-w-none
          lg:transition-[width] ${sidebarOpen ? 'lg:w-64' : 'lg:w-20'}
        `}
        /* A closed drawer is off-screen but its links are still in the document.
           `inert` takes them out of the tab order and the accessibility tree, so
           a keyboard user is not sent to links they cannot see. */
        inert={!isDesktop && !sidebarOpen}
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
          {showLabels && (
            <div className="overflow-hidden animate-fade-in min-w-0">
              <p className="t-gradient font-extrabold text-sm tracking-wider uppercase leading-tight">School</p>
              <p className="t-muted text-[11px] font-semibold">Management Hub</p>
            </div>
          )}
          {/* Closing the drawer from inside it — the scrim is not obvious on a
              phone, and the header's button is behind the drawer. */}
          {!isDesktop && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="icon-btn ml-auto lg:hidden"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto overscroll-contain">
          {visibleGroups.map(group => (
            <div key={group.label}>
              {showLabels && (
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
                    title={showLabels ? undefined : label}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150 group ${
                        isActive ? 'nav-active' : 'nav-idle'
                      } ${showLabels ? '' : 'justify-center'}`
                    }
                  >
                    <Icon size={17} className="flex-shrink-0" />
                    {showLabels && (
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
          {showLabels ? (
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-surface backdrop-blur-xl border-b border-line px-3 sm:px-5 py-3 flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="icon-btn flex-shrink-0"
            title={isDesktop ? (sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar') : 'Open menu'}
            aria-label={isDesktop ? 'Toggle sidebar' : 'Open menu'}
            aria-expanded={sidebarOpen}
          >
            {isDesktop
              ? (sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />)
              : <Menu size={18} />}
          </button>

          {/* Campus and session. On a phone these are the widest thing in the bar,
              so they take the row to themselves under the header instead. */}
          <div className="hidden md:flex items-center gap-2.5 ml-1 min-w-0">
            <ContextPickers
              campuses={campuses}
              sessions={sessions}
              currentCampus={currentCampus}
              setCurrentCampus={setCurrentCampus}
              currentSession={currentSession}
              setCurrentSession={setCurrentSession}
            />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeToggle />
            <div className="flex items-center gap-2.5 surface-muted rounded-full px-2 sm:px-3 py-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--sms-primary) 0%, var(--sms-accent) 140%)', color: '#fff' }}
              >
                {initial}
              </div>
              <span className="t-body text-xs font-semibold hidden lg:inline max-w-[10rem] truncate">{user?.name}</span>
              <span className="badge badge-brand text-[9px] hidden sm:inline-flex">{user?.role}</span>
            </div>
          </div>
        </header>

        {/* The narrow-screen home for the campus / session pickers. */}
        {(campuses.length > 0 || sessions.length > 0) && (
        <div className="md:hidden bg-surface border-b border-line px-3 py-2 flex items-center gap-2 flex-shrink-0">
          <ContextPickers
            campuses={campuses}
            sessions={sessions}
            currentCampus={currentCampus}
            setCurrentCampus={setCurrentCampus}
            currentSession={currentSession}
            setCurrentSession={setCurrentSession}
          />
        </div>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/**
 * Both lists arrive already narrowed to this account's campus and session scope,
 * so a switcher only appears where there is genuinely something to switch
 * between. With exactly one choice the name is shown as a plain label — the
 * server pins the account to it anyway, whatever the client sends.
 */
function ContextPickers({
  campuses, sessions,
  currentCampus, setCurrentCampus,
  currentSession, setCurrentSession,
}) {
  return (
    <>
      {campuses.length > 1 ? (
        <ContextSelect
          icon={Building2}
          value={currentCampus}
          onChange={(e) => setCurrentCampus(e.target.value)}
          placeholder="Select Campus"
        >
          {campuses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </ContextSelect>
      ) : campuses.length === 1 && (
        <span className="field flex items-center gap-2 py-2 text-[11px] font-bold uppercase tracking-wider min-w-0 flex-1 sm:flex-none sm:w-auto">
          <Building2 size={13} className="t-faint flex-shrink-0" />
          <span className="truncate">{campuses[0].name}</span>
        </span>
      )}

      {sessions.length > 1 ? (
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
      ) : sessions.length === 1 && (
        <span className="field flex items-center gap-2 py-2 text-[11px] font-bold uppercase tracking-wider min-w-0 flex-1 sm:flex-none sm:w-auto">
          <CalendarDays size={13} className="t-faint flex-shrink-0" />
          <span className="truncate">{sessions[0].name}</span>
        </span>
      )}
    </>
  );
}
