import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface IntrayCount {
  tasks_count: number;
  signoffs_count: number;
  actions_count: number;
  total_count: number;
}

export function useIntrayCount(targetUserId?: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['intray-count', targetUserId ?? user?.id],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (targetUserId) {
        params.p_user_id = targetUserId;
      }

      const { data, error } = await supabase.rpc('get_user_intray_count', params as any);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row || { tasks_count: 0, signoffs_count: 0, actions_count: 0, total_count: 0 }) as IntrayCount;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
