import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface RoleUser {
  id: string;
  full_name: string;
  username: string | null;
}

export function useRoleUsers(role: AppRole) {
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', role);

      if (error || !data?.length) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const userIds = data.map((r) => r.user_id);
      const { data: appUsers, error: usersError } = await supabase
        .from('app_users')
        .select('id, full_name, username')
        .in('id', userIds);

      if (usersError || !appUsers) {
        setUsers([]);
      } else {
        setUsers(appUsers);
      }
      setLoading(false);
    }

    fetchUsers();
  }, [role]);

  return { users, loading };
}
