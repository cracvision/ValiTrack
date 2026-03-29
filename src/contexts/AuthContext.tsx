import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import i18n from '@/lib/i18n';
import type { User, Session } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: { full_name: string; email: string; must_change_password: boolean; theme_preference: string } | null;
  roles: AppRole[];
  loading: boolean;
  isSigningOut: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  hasRole: (role: AppRole) => boolean;
  isSuperUser: () => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_STATE: AuthState = {
  user: null,
  session: null,
  profile: null,
  roles: [],
  loading: false,
  isSigningOut: false,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    ...EMPTY_STATE,
    loading: true,
  });

  const isMounted = useRef(true);
  const signingOutRef = useRef(false);
  const profileLoadedRef = useRef(false);

  const safeSetState = useCallback((updater: AuthState | ((prev: AuthState) => AuthState)) => {
    if (isMounted.current) {
      setState(updater);
    }
  }, []);

  const fetchProfileAndRoles = useCallback(async (userId: string) => {
    // Don't fetch if signing out
    if (signingOutRef.current) return;

    try {
      const [profileRes, rolesRes, langRes] = await Promise.all([
        supabase.from('app_users').select('full_name, email, must_change_password, theme_preference').eq('id', userId).single(),
        supabase.rpc('get_user_roles', { _user_id: userId }),
        supabase.from('user_language_preference').select('language_code').eq('user_id', userId).single(),
      ]);

      // Don't update state if signing out or unmounted
      if (signingOutRef.current || !isMounted.current) return;

      const langCode = langRes.data?.language_code;
      if (langCode && ['es', 'en'].includes(langCode)) {
        i18n.changeLanguage(langCode);
      }

      safeSetState((prev) => ({
        ...prev,
        profile: profileRes.data ?? null,
        roles: (rolesRes.data as AppRole[]) ?? [],
        loading: false,
      }));
      profileLoadedRef.current = true;
    } catch {
      // If fetch fails during signout, just ignore
      if (!signingOutRef.current && isMounted.current) {
        safeSetState((prev) => ({ ...prev, loading: false }));
      }
    }
  }, [safeSetState]);

  useEffect(() => {
    isMounted.current = true;
    let initialSessionHandled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT') {
          // Synchronous, atomic state clear
          safeSetState({ ...EMPTY_STATE });
          profileLoadedRef.current = false;
          i18n.changeLanguage('es');
          return;
        }

        safeSetState((prev) => ({ ...prev, user: session?.user ?? null, session }));

        if (session?.user && !signingOutRef.current && !profileLoadedRef.current) {
          setTimeout(() => fetchProfileAndRoles(session.user.id), 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialSessionHandled || !isMounted.current) return;
      initialSessionHandled = true;

      safeSetState((prev) => ({ ...prev, user: session?.user ?? null, session }));

      if (session?.user) {
        fetchProfileAndRoles(session.user.id);
      } else {
        safeSetState((prev) => ({ ...prev, loading: false }));
      }
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileAndRoles, safeSetState]);

  const signIn = useCallback(async (email: string, password: string) => {
    signingOutRef.current = false;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    // Set flag BEFORE calling signOut to prevent any in-flight fetches
    signingOutRef.current = true;
    safeSetState((prev) => ({ ...prev, isSigningOut: true }));
    await supabase.auth.signOut();
    // State cleanup happens in onAuthStateChange SIGNED_OUT handler
  }, [safeSetState]);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error && state.user) {
      await supabase.from('app_users').update({ must_change_password: false }).eq('id', state.user.id);
      safeSetState((prev) => ({
        ...prev,
        profile: prev.profile ? { ...prev.profile, must_change_password: false } : null,
      }));
    }
    return { error };
  }, [state.user, safeSetState]);

  const hasRole = useCallback((role: AppRole) => state.roles.includes(role), [state.roles]);
  const isSuperUser = useCallback(() => hasRole('super_user'), [hasRole]);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    updatePassword,
    hasRole,
    isSuperUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
