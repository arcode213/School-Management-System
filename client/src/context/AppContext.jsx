import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const AppContext = createContext();

export function AppProvider({ children }) {
  const { user, setActiveCampus } = useAuth();
  const [campuses, setCampuses] = useState(() => {
    try {
      const cached = localStorage.getItem('sms_campuses_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [sessions, setSessions] = useState([]);
  
  const [currentCampus, setCurrentCampus] = useState(() => localStorage.getItem('sms_campus'));
  const [currentSession, setCurrentSession] = useState(() => localStorage.getItem('sms_session'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchSystemData = async () => {
      try {
        const [campRes, sessRes] = await Promise.all([
          api.get('/system/campuses'),
          api.get('/system/sessions')
        ]);
        
        setCampuses(campRes.data);
        try {
          localStorage.setItem('sms_campuses_cache', JSON.stringify(campRes.data));
        } catch {}
        setSessions(sessRes.data);

        // Both lists come back already narrowed to this account's campus and
        // session scope, so "is it in the list" is the same question as "is this
        // account allowed it". A stored choice that is no longer in the list —
        // because the admin just tightened the scope — is dropped and replaced
        // below rather than left selected.
        let validCampus = currentCampus;
        if (currentCampus && !campRes.data.find(c => c._id === currentCampus)) {
          validCampus = null;
          localStorage.removeItem('sms_campus');
        }

        // Set default campus (from user or first available)
        if (!validCampus) {
          if (user.campus && campRes.data.find(c => c._id === user.campus)) {
            setCurrentCampus(user.campus);
            localStorage.setItem('sms_campus', user.campus);
          } else if (campRes.data.length > 0) {
            setCurrentCampus(campRes.data[0]._id);
            localStorage.setItem('sms_campus', campRes.data[0]._id);
          } else {
            setCurrentCampus(null);
            localStorage.removeItem('sms_campus');
          }
        }

        // Validate currentSession
        let validSession = currentSession;
        if (currentSession && !sessRes.data.find(s => s._id === currentSession)) {
          validSession = null;
          localStorage.removeItem('sms_session');
        }

        // Set default session (active session)
        if (!validSession) {
          const activeSess = sessRes.data.find(s => s.isActive);
          if (activeSess) {
            setCurrentSession(activeSess._id);
            localStorage.setItem('sms_session', activeSess._id);
          } else if (sessRes.data.length > 0) {
            setCurrentSession(sessRes.data[0]._id);
            localStorage.setItem('sms_session', sessRes.data[0]._id);
          } else {
            setCurrentSession(null);
            localStorage.removeItem('sms_session');
          }
        }
      } catch (err) {
        console.error('Failed to load system context:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemData();
  }, [user]);

  // Permissions can differ per campus, and AuthContext is the one answering
  // `can()` — so the campus selection has to travel back up to it. Switching
  // campus can therefore change what the sidebar and the buttons offer, which is
  // the whole point of per-campus rights.
  useEffect(() => {
    setActiveCampus(currentCampus || null);
  }, [currentCampus, setActiveCampus]);

  const handleSetCampus = (id) => {
    setCurrentCampus(id);
    localStorage.setItem('sms_campus', id);
  };

  const handleSetSession = (id) => {
    setCurrentSession(id);
    localStorage.setItem('sms_session', id);
  };

  return (
    <AppContext.Provider value={{
      campuses, sessions,
      currentCampus, setCurrentCampus: handleSetCampus,
      currentSession, setCurrentSession: handleSetSession,
      loading
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
