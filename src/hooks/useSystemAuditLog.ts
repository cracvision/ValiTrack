import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AuditEntry {
  id: string;
  action: string;
  created_at: string;
  user_id: string | null;
  details: Record<string, any> | null;
  full_name?: string;
}

export function useRecentAuditLog(limit: number = 10) {
  return useQuery({
    queryKey: ['recent-audit-log', limit],
    queryFn: async (): Promise<AuditEntry[]> => {
      // Fetch audit entries
      const { data: entries, error } = await supabase
        .from('audit_log')
        .select('id, action, created_at, user_id, details')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!entries || entries.length === 0) return [];

      // Batch-fetch user names for all unique user_ids
      const userIds = [...new Set(entries.filter(e => e.user_id).map(e => e.user_id!))];

      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('app_users')
          .select('id, full_name')
          .in('id', userIds);

        if (users) {
          userMap = Object.fromEntries(users.map(u => [u.id, u.full_name]));
        }
      }

      return entries.map(e => ({
        ...e,
        full_name: e.user_id ? (userMap[e.user_id] ?? undefined) : undefined,
      })) as AuditEntry[];
    },
    staleTime: 2 * 60 * 1000,
  });
}
