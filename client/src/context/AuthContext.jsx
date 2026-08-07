import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/axios';
import { can as canDo, canAny as canAnyDo } from '../utils/permissions';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('sms_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  /**
   * The campus every `can()` answer is measured against.
   *
   * Rights can differ per campus, so "may this user delete a challan" has no
   * answer until you say where. AppContext owns the campus switcher and pushes
   * the selection down here (it renders inside this provider, so it cannot be
   * read the other way round). Seeded from localStorage so the very first render
   * — before AppContext has fetched anything — already resolves to the right
   * campus instead of briefly falling back to the default grid.
   */
  const [activeCampus, setActiveCampus] = useState(() => localStorage.getItem('sms_campus') || null);

  /**
   * Re-read the account from the server on load.
   *
   * The cached copy in localStorage is a snapshot from login time. If the admin
   * changes someone's permissions or campus scope while they are working, this is
   * what picks it up on their next refresh instead of leaving them with a stale
   * grid until they log out. A failure here is ignored on purpose — the cached
   * user still works, and a genuinely invalid token is handled by the 401
   * interceptor in api/axios.js.
   */
  useEffect(() => {
    if (!localStorage.getItem('sms_token')) return;

    let cancelled = false;
    api.get('/auth/me')
      .then(({ data }) => {
        if (cancelled || !data?._id) return;
        setUser(prev => {
          const merged = { ...data, token: prev?.token };
          localStorage.setItem('sms_user', JSON.stringify(merged));
          return merged;
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('sms_token', data.token);
      localStorage.setItem('sms_user', JSON.stringify(data));
      setUser(data);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('sms_token');
    localStorage.removeItem('sms_user');
    // The campus / session a restricted account was pinned to must not survive
    // into the next person's session on a shared office machine — including the
    // in-memory copy, which `can()` is measured against. Left behind, the next
    // person to sign in would briefly be judged against the previous user's
    // campus before AppContext re-syncs.
    localStorage.removeItem('sms_campus');
    localStorage.removeItem('sms_session');
    setActiveCampus(null);
    setUser(null);
  };

  // Bound to the signed-in account and the campus they are working in, so screens
  // can ask `can('fees', 'edit')` without threading either through every call.
  const can = useCallback(
    (moduleKey, action = 'view') => canDo(user, moduleKey, action, activeCampus),
    [user, activeCampus]
  );
  const canAny = useCallback(
    (moduleKey) => canAnyDo(user, moduleKey, activeCampus),
    [user, activeCampus]
  );

  const value = useMemo(
    () => ({
      user, login, logout, loading, can, canAny,
      activeCampus, setActiveCampus,
      isAdmin: user?.role === 'Admin',
    }),
    [user, loading, can, canAny, activeCampus]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
