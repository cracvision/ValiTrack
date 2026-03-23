import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CheckoffDetail {
  stepIndex: number;
  checkedBy: string;
  checkedByName?: string;
  checkedAt: string;
}

export function useTaskCheckoffs(taskId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['task-checkoffs', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('task_instruction_checkoffs')
        .select('*')
        .eq('task_id', taskId)
        .eq('is_deleted', false)
        .order('step_index', { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        task_id: string;
        step_index: number;
        created_by: string;
        created_at: string;
        is_deleted: boolean;
      }>;
    },
    enabled: !!taskId,
    staleTime: 30_000,
  });

  // Resolve names for checked-by users
  const checkedByIds = [...new Set((query.data || []).map(c => c.created_by))];
  const namesQuery = useQuery({
    queryKey: ['resolve-user-names', ...checkedByIds.sort()],
    queryFn: async () => {
      if (checkedByIds.length === 0) return {};
      const { data, error } = await supabase
        .rpc('resolve_user_names', { user_ids: checkedByIds });
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((row: { id: string; full_name: string }) => {
        map[row.id] = row.full_name;
      });
      return map;
    },
    enabled: checkedByIds.length > 0,
    staleTime: 5 * 60_000,
  });

  const checkedSteps = new Set((query.data || []).map(c => c.step_index));

  const checkoffDetails = new Map<number, CheckoffDetail>();
  for (const c of query.data || []) {
    checkoffDetails.set(c.step_index, {
      stepIndex: c.step_index,
      checkedBy: c.created_by,
      checkedByName: namesQuery.data?.[c.created_by],
      checkedAt: c.created_at,
    });
  }

  const toggleCheckoff = useMutation({
    mutationFn: async (stepIndex: number) => {
      if (!taskId || !user?.id) throw new Error('Missing task or user');

      const isChecked = checkedSteps.has(stepIndex);

      if (isChecked) {
        // Soft delete — find the active checkoff and mark deleted
        const existing = (query.data || []).find(c => c.step_index === stepIndex);
        if (!existing) throw new Error('Checkoff not found');

        const { error } = await supabase
          .from('task_instruction_checkoffs')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: user.id,
            updated_by: user.id,
          } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // INSERT new checkoff
        const { error } = await supabase
          .from('task_instruction_checkoffs')
          .insert({
            task_id: taskId,
            step_index: stepIndex,
            created_by: user.id,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-checkoffs', taskId] });
    },
  });

  return {
    checkoffs: query.data || [],
    isLoading: query.isLoading,
    checkedSteps,
    checkoffDetails,
    completedCount: checkedSteps.size,
    toggleCheckoff,
  };
}
