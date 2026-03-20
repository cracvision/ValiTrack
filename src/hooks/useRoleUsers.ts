import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface RoleUser {
  id: string;
  full_name: string;
  username: string | null;
}

export function useRoleUsers(role: AppRole) {
  const { data: users = [], isLoading: loading } = useQuery<RoleUser[]>({
    queryKey: ['role-users', role],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_users_by_role', { p_role: role });

      if (error) {
        console.error(`[useRoleUsers] Failed to fetch users for role "${role}":`, error.message);
        return [];
      }

      return (data || []) as RoleUser[];
    },
    staleTime: 5 * 60 * 1000,
  });

  return { users, loading };
}
