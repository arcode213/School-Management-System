import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Route guard.
 *
 * `module` is the permission-based gate — the account needs `view` on that module
 * to reach the screen. `allowedRoles` remains for the handful of places that are
 * the main admin's alone (user management) and are not grantable at all.
 */
export const ProtectedRoute = ({ allowedRoles, module, action = 'view' }) => {
  const { user, can } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (module && !can(module, action)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};
