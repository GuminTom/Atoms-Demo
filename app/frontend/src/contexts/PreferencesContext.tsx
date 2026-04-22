import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';

export interface WorkspacePrefs {
  theme: string;
  font_size: number;
  tab_size: number;
  word_wrap: boolean;
  auto_save: boolean;
  auto_save_delay: number;
}

const DEFAULT_PREFS: WorkspacePrefs = {
  theme: 'dark',
  font_size: 14,
  tab_size: 2,
  word_wrap: true,
  auto_save: true,
  auto_save_delay: 2000,
};

interface PreferencesContextValue {
  prefs: WorkspacePrefs;
  updatePrefs: (partial: Partial<WorkspacePrefs>) => void;
  loading: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  prefs: DEFAULT_PREFS,
  updatePrefs: () => {},
  loading: true,
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<WorkspacePrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  // Apply theme to DOM whenever it changes
  const applyTheme = useCallback((theme: string) => {
    const root = document.documentElement;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', isDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  }, []);

  // Load preferences on mount
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const data = await api.get('/api/v1/users/preferences');
        if (data?.preferences) {
          const loaded = { ...DEFAULT_PREFS, ...data.preferences };
          setPrefs(loaded);
          applyTheme(loaded.theme);
        } else {
          applyTheme(DEFAULT_PREFS.theme);
        }
      } catch {
        applyTheme(DEFAULT_PREFS.theme);
      } finally {
        setLoading(false);
      }
    };
    loadPrefs();
  }, [applyTheme]);

  // Listen for system theme changes when theme is 'system'
  useEffect(() => {
    if (prefs.theme !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [prefs.theme]);

  const updatePrefs = useCallback((partial: Partial<WorkspacePrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...partial };
      if (partial.theme !== undefined) {
        applyTheme(partial.theme);
      }
      return next;
    });
  }, [applyTheme]);

  return (
    <PreferencesContext.Provider value={{ prefs, updatePrefs, loading }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}