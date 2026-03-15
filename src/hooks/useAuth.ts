import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: { full_name: string; email: string; must_change_password: boolean } | null;
  roles: AppRole[];
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    roles: [],
    loading: true,
  });

  const fetchProfileAndRoles = useCallback(async (userId: string) => {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from('app_users').select('full_name, email, must_change_password').eq('id', userId).single(),
      supabase.rpc('get_user_roles', { _user_id: userId }),
    ]);

    setState((prev) => ({
      ...prev,
      profile: profileRes.data ?? null,
      roles: (rolesRes.data as AppRole[]) ?? [],
      loading: false,
    }));
  }, []);

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setState((prev) => ({ ...prev, user: session?.user ?? null, session }));
        if (session?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase auth
          setTimeout(() => fetchProfileAndRoles(session.user.id), 0);
        } else {
          setState((prev) => ({ ...prev, profile: null, roles: [], loading: false }));
        }
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((prev) => ({ ...prev, user: session?.user ?? null, session }));
      if (session?.user) {
        fetchProfileAndRoles(session.user.id);
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfileAndRoles]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error && state.user) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', state.user.id);
      setState((prev) => ({
        ...prev,
        profile: prev.profile ? { ...prev.profile, must_change_password: false } : null,
      }));
    }
    return { error };
  };

  const hasRole = (role: AppRole) => state.roles.includes(role);
  const isSuperUser = () => hasRole('super_user');

  return {
    ...state,
    signIn,
    signOut,
    updatePassword,
    hasRole,
    isSuperUser,
  };
}
