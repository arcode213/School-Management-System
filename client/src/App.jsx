import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import StudentProfilePage from './pages/StudentProfilePage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import FeesPage from './pages/FeesPage';
import ChallansPage from './pages/ChallansPage';
import DuesPage from './pages/DuesPage';
import ReportsPage from './pages/ReportsPage';

// Placeholder pages (filled in later steps)
const Unauthorized = () => <div className="text-red-500 p-8"><h1 className="text-2xl font-bold">403 – Unauthorized</h1><p>You don't have permission to view this page.</p></div>;

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected layout routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/students/:id" element={<StudentProfilePage />} />
              <Route path="/dues" element={<DuesPage />} />

              {/* Admin + Accountant */}
              <Route element={<ProtectedRoute allowedRoles={['Admin', 'Accountant']} />}>
                <Route path="/fees" element={<FeesPage />} />
                <Route path="/challans" element={<ChallansPage />} />
              </Route>

              {/* Admin only */}
              <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/:id" element={<EmployeeProfilePage />} />
                <Route path="/reports" element={<ReportsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
