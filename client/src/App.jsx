import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import StudentProfilePage from './pages/StudentProfilePage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import PromotionsPage from './pages/PromotionsPage';
import SystemSettingsPage from './pages/SystemSettingsPage';
import FeeStructurePage from './pages/FeeStructurePage';
import FeesPage from './pages/FeesPage';
import ChallansPage from './pages/ChallansPage';
import DuesPage from './pages/DuesPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import AccountsPage from './pages/AccountsPage';
import SalarySheetPage from './pages/SalarySheetPage';
import AuditLogsPage from './pages/AuditLogsPage';
import { useAuth } from './context/AuthContext';
import { landingPathFor } from './utils/navigation';

const Unauthorized = () => (
  <div className="p-8 max-w-lg">
    <h1 className="text-2xl font-bold t-bad">403 – No Access</h1>
    <p className="t-muted text-sm mt-2 leading-relaxed">
      Your account has not been given access to this screen. If you need it, ask the
      system administrator to tick it for you under User Management.
    </p>
    <Link to="/" className="inline-block mt-4 text-xs font-bold uppercase tracking-wider t-brand hover:underline">
      Go to my home screen
    </Link>
  </div>
);

/**
 * The landing screen.
 *
 * Most accounts get the dashboard. One that was not granted it is sent to the
 * first screen it can actually open, rather than to a page that would only answer
 * 403 — a fee cashier lands on Fee Management.
 */
function Home() {
  const { user, can } = useAuth();
  if (can('dashboard', 'view')) return <DashboardPage />;

  const fallback = landingPathFor(user, can);
  if (fallback && fallback !== '/') return <Navigate to={fallback} replace />;
  return <Unauthorized />;
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          {/* Toasts read their colours from the theme tokens so they never appear
              as a white card on a dark portal (or the reverse). */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: 'var(--sms-surface-solid)',
                color: 'var(--sms-text)',
                border: '1px solid var(--sms-border)',
                boxShadow: 'var(--sms-shadow-lg)',
                fontSize: '0.8125rem',
                fontWeight: 500,
              },
              success: { iconTheme: { primary: 'var(--sms-success)', secondary: 'var(--sms-surface-solid)' } },
              error: { iconTheme: { primary: 'var(--sms-danger)', secondary: 'var(--sms-surface-solid)' } },
            }}
          />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected layout routes.

              Each screen is gated on the permission module it belongs to rather
              than on a role name, so what a person can open is whatever the admin
              ticked for their account. The server checks the same module on every
              request behind these screens. */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />

              <Route element={<ProtectedRoute module="students" />}>
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/students/:id" element={<StudentProfilePage />} />
              </Route>

              <Route element={<ProtectedRoute module="employees" />}>
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/:id" element={<EmployeeProfilePage />} />
              </Route>

              {/* The expense register is a tab inside Accounts & Ledger. Either
                  grant opens the screen; the tab strip then shows only what the
                  account is entitled to. */}
              <Route element={<ProtectedRoute anyModule={['accounts', 'expenses']} />}>
                <Route path="/accounts" element={<AccountsPage />} />
              </Route>

              <Route element={<ProtectedRoute module="salaries" />}>
                <Route path="/salaries" element={<SalarySheetPage />} />
              </Route>

              <Route element={<ProtectedRoute module="fees" />}>
                <Route path="/fees" element={<FeesPage />} />
              </Route>

              <Route element={<ProtectedRoute module="feeStructures" />}>
                <Route path="/fee-structures" element={<FeeStructurePage />} />
              </Route>

              <Route element={<ProtectedRoute module="challans" />}>
                <Route path="/challans" element={<ChallansPage />} />
              </Route>

              <Route element={<ProtectedRoute module="promotions" />}>
                <Route path="/promotions" element={<PromotionsPage />} />
              </Route>

              <Route element={<ProtectedRoute module="dues" />}>
                <Route path="/dues" element={<DuesPage />} />
              </Route>

              <Route element={<ProtectedRoute module="reports" />}>
                <Route path="/reports" element={<ReportsPage />} />
              </Route>

              <Route element={<ProtectedRoute module="settings" />}>
                <Route path="/settings" element={<SystemSettingsPage />} />
              </Route>

              {/* Accounts, their permissions, and the audit trail are the main
                  admin's alone — a role check, never a grantable permission. */}
              <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
                <Route path="/users" element={<UsersPage />} />
                <Route path="/logs" element={<AuditLogsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
