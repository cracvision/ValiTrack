import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ReviewTask } from '@/types';

export function useReviewTasks(reviewCaseId: string | undefined) {
  return useQuery({
    queryKey: ['review-tasks', reviewCaseId],
    queryFn: async (): Promise<ReviewTask[]> => {
      if (!reviewCaseId) return [];

      const { data, error } = await supabase
        .from('review_tasks')
        .select('*')
        .eq('review_case_id', reviewCaseId)
        .eq('is_deleted', false)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Collect unique user IDs for name resolution
      const userIds = [...new Set([
        ...data.map((t: any) => t.assigned_to),
        ...data.map((t: any) => t.approved_by_user),
      ].filter(Boolean))];

      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .rpc('resolve_user_names', { user_ids: userIds });
        if (users) {
          userMap = Object.fromEntries(
            users.map((u: { id: string; full_name: string }) => [u.id, u.full_name])
          );
        }
      }

      return data.map((row: any) => ({
        id: row.id,
        review_case_id: row.review_case_id,
        template_id: row.template_id ?? undefined,
        task_group: row.task_group,
        title: row.title,
        description: row.description,
        assigned_to: row.assigned_to,
        approved_by_user: row.approved_by_user ?? undefined,
        status: row.status,
        phase: row.phase,
        execution_type: row.execution_type,
        due_date: row.due_date,
        started_at: row.started_at ?? undefined,
        completed_at: row.completed_at ?? undefined,
        completion_notes: row.completion_notes ?? undefined,
        sort_order: row.sort_order,
        created_at: row.created_at,
        created_by: row.created_by,
        updated_at: row.updated_at,
        is_deleted: row.is_deleted,
        assigned_to_name: userMap[row.assigned_to] || '—',
        approved_by_name: userMap[row.approved_by_user] || '—',
      }));
    },
    enabled: !!reviewCaseId,
  });
}
