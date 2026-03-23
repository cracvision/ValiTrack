import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PhaseStatus {
  phase: number;
  total: number;
  completed: number;
  is_complete: boolean;
}

export interface TaskPhaseUnlocked {
  unlocked: boolean;
  blocking_phase?: number;
  blocking_phase_total?: number;
  blocking_phase_completed?: number;
  error?: string;
}

export function useReviewCasePhases(reviewCaseId: string | undefined) {
  return useQuery({
    queryKey: ['review-case-phases', reviewCaseId],
    queryFn: async (): Promise<PhaseStatus[]> => {
      if (!reviewCaseId) return [];
      const { data, error } = await supabase.rpc('get_review_case_phase_summary', {
        p_review_case_id: reviewCaseId,
      } as any);
      if (error) throw error;
      return (data as unknown as PhaseStatus[]) || [];
    },
    enabled: !!reviewCaseId,
  });
}

export function useTaskPhaseUnlocked(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-phase-unlocked', taskId],
    queryFn: async (): Promise<TaskPhaseUnlocked> => {
      if (!taskId) return { unlocked: true };
      const { data, error } = await supabase.rpc('check_task_phase_unlocked', {
        p_task_id: taskId,
      } as any);
      if (error) throw error;
      return data as unknown as TaskPhaseUnlocked;
    },
    enabled: !!taskId,
  });
}
