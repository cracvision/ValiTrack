import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReviewCaseTransition } from '@/types';

export function useReviewTransitions(reviewCaseId: string | undefined) {
  return useQuery({
    queryKey: ['review-transitions', reviewCaseId],
    queryFn: async (): Promise<ReviewCaseTransition[]> => {
      if (!reviewCaseId) return [];

      const { data, error } = await supabase
        .from('review_case_transitions')
        .select('*')
        .eq('review_case_id', reviewCaseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Use SECURITY DEFINER RPC to resolve names (works for all roles)
      const userIds = [...new Set(data.map((t: any) => t.transitioned_by).filter(Boolean))];
      let userMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .rpc('resolve_user_names', { user_ids: userIds });

        if (users) {
          userMap = Object.fromEntries(users.map((u: { id: string; full_name: string }) => [u.id, u.full_name]));
        }
      }

      return data.map((row: any) => ({
        id: row.id,
        review_case_id: row.review_case_id,
        from_status: row.from_status,
        to_status: row.to_status,
        reason: row.reason ?? undefined,
        transitioned_by: row.transitioned_by,
        created_at: row.created_at,
        transitioned_by_name: userMap[row.transitioned_by] || 'System',
      }));
    },
    enabled: !!reviewCaseId,
  });
}