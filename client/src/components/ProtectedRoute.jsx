import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Route guard.
 *
 * `module` is the permission-based gate — the account needs `view` on that module
 * to reach the screen. `allowedRoles` remains for the handful of places that are
 * the main admin's alone (user management) and are not grantable at all.
 *
 * `anyModule` takes a list and passes if ANY of them is granted. It exists for a
 * screen that serves two audiences: Accounts & Ledger holds both the ledger
 * (an `accounts` job) and the expense register (an `expenses` job), and an
 * account granted only one of those must still be able to open it. The server
 * enforces the same rule per endpoint via `requireAnyPermission`, so a narrower
 * account simply finds the tabs it is not entitled to absent.
 */
export const ProtectedRoute = ({ allowedRoles, module, anyModule, action = 'view' }) => {
  const { user, can } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (module && !can(module, action)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (anyModule && !anyModule.some((m) => can(m, action))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};
