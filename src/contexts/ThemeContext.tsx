import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setTheme: (theme: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystemTheme(): ResolvedTheme {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'light' : 'dark';
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>(resolveSystemTheme);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedUserIdRef = useRef<string | null>(null);

  const computeAndApply = useCallback((pref: ThemePreference) => {
    const r: ResolvedTheme = pref === 'system' ? resolveSystemTheme() : pref;
    setResolved(r);
    applyTheme(r);
  }, []);

  // Load preference from DB when user is available
  useEffect(() => {
    if (!user) {
      loadedUserIdRef.current = null;
      return;
    }
    if (loadedUserIdRef.current === user.id) return;

    loadedUserIdRef.current = user.id;
    supabase
      .from('app_users')
      .select('theme_preference')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const pref = (data?.theme_preference as ThemePreference) ?? 'system';
        setPreference(pref);
        computeAndApply(pref);
      });
  }, [user, computeAndApply]);

  // Re-evaluate system theme every 60s
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (preference === 'system') {
      computeAndApply('system');
      intervalRef.current = setInterval(() => {
        computeAndApply('system');
      }, 60_000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [preference, computeAndApply]);

  const setTheme = useCallback(async (newPref: ThemePreference) => {
    if (!user) return;

    const prevPref = preference;
    setPreference(newPref);
    computeAndApply(newPref);

    const { error } = await supabase
      .from('app_users')
      .update({ theme_preference: newPref, updated_at: new Date().toISOString() } as any)
      .eq('id', user.id);

    if (error) {
      console.error('[ThemeContext] Failed to persist theme preference:', error);
      setPreference(prevPref);
      computeAndApply(prevPref);
    }
  }, [user, preference, computeAndApply]);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
