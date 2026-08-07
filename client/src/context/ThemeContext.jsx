import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'sms_theme';

// The user's saved choice, or the operating system's preference when they have
// never chosen. Reading the OS preference matters for a portal used all day in a
// school office: a machine set to light should not open onto a black screen.
export const resolveInitialTheme = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // localStorage can throw in private-browsing / restricted modes.
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the OS only while the user has made no explicit choice of their own.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return;
    const onChange = (e) => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        return;
      }
      setThemeState(e.matches ? 'light' : 'dark');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to persist the choice must not break the toggle.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
