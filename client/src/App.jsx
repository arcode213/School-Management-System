import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import ExpensesPage from './pages/ExpensesPage';

// Placeholder pages (filled in later steps)
const Unauthorized = () => <div className="t-bad p-8"><h1 className="text-2xl font-bold">403 – Unauthorized</h1><p>You don't have permission to view this page.</p></div>;

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

          {/* Protected layout routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              {/* Admin, Administrator, Staff */}
              <Route element={<ProtectedRoute allowedRoles={['Admin', 'Administrator', 'Staff']} />}>
                <Route path="/students" element={<StudentsPage />} />
                <Route path="/students/:id" element={<StudentProfilePage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/:id" element={<EmployeeProfilePage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/fees" element={<FeesPage />} />
                <Route path="/fee-structures" element={<FeeStructurePage />} />
                <Route path="/challans" element={<ChallansPage />} />
              </Route>

              {/* Admin & Administrator only routes */}
              <Route element={<ProtectedRoute allowedRoles={['Admin', 'Administrator']} />}>
                <Route path="/promotions" element={<PromotionsPage />} />
                <Route path="/dues" element={<DuesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
              </Route>

              {/* Admin only routes */}
              <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
                <Route path="/users" element={<UsersPage />} />
                <Route path="/settings" element={<SystemSettingsPage />} />
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
