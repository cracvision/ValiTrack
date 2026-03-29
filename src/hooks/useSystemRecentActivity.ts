import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SystemActivity {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  user_id: string | null;
  user_name: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export function useSystemRecentActivity(systemId: string | undefined) {
  return useQuery<SystemActivity[]>({
    queryKey: ['system-recent-activity', systemId],
    queryFn: async () => {
      if (!systemId) return [];

      const { data, error } = await supabase.rpc(
        'get_system_recent_activity' as any,
        { p_system_id: systemId, p_limit: 3 }
      );

      if (error) {
        console.error('Failed to fetch system activity:', error);
        return [];
      }

      return (data ?? []) as SystemActivity[];
    },
    enabled: !!systemId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
