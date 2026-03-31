import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface IntrayItem {
  item_type: 'task' | 'review_signoff' | 'profile_signoff' | 'action';
  item_id: string;
  assigned_user_id: string;
  assigned_user_name: string | null;
  review_case_id: string | null;
  system_profile_id: string;
  system_name: string;
  system_identifier: string;
  review_case_status: string;
  title: string;
  title_es: string | null;
  description: string;
  description_es: string | null;
  item_status: string;
  due_date: string | null;
  item_created_at: string;
  urgency: 'overdue' | 'due_soon' | 'upcoming';
  action_code: string | null;
  context_data: Record<string, unknown>;
}

export function useIntrayItems(targetUserId?: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['intray-items', targetUserId ?? user?.id],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (targetUserId) {
        params.p_user_id = targetUserId;
      }

      const { data, error } = await supabase.rpc('get_user_intray_items', params as any);
      if (error) throw error;
      return (data || []) as IntrayItem[];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
