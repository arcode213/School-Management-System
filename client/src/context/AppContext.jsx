import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const AppContext = createContext();

export function AppProvider({ children }) {
  const { user } = useAuth();
  const [campuses, setCampuses] = useState([]);
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
        setSessions(sessRes.data);

        // Set default campus (from user or first available)
        if (!currentCampus) {
          if (user.campus) {
            setCurrentCampus(user.campus);
            localStorage.setItem('sms_campus', user.campus);
          } else if (campRes.data.length > 0) {
            setCurrentCampus(campRes.data[0]._id);
            localStorage.setItem('sms_campus', campRes.data[0]._id);
          }
        }

        // Set default session (active session)
        if (!currentSession) {
          const activeSess = sessRes.data.find(s => s.isActive);
          if (activeSess) {
            setCurrentSession(activeSess._id);
            localStorage.setItem('sms_session', activeSess._id);
          } else if (sessRes.data.length > 0) {
            setCurrentSession(sessRes.data[0]._id);
            localStorage.setItem('sms_session', sessRes.data[0]._id);
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
