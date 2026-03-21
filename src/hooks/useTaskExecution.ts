import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useResolveUserNames } from '@/hooks/useResolveUserNames';
import { toast } from '@/hooks/use-toast';
import type { ReviewTask } from '@/types';

interface UseTaskExecutionOptions {
  task: ReviewTask | undefined;
  reviewCaseId: string;
  reviewCaseStatus: string;
}

export function useTaskExecution({ task, reviewCaseId, reviewCaseStatus }: UseTaskExecutionOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: userNames = {} } = useResolveUserNames(userId ? [userId] : []);
  const currentUserName = userId ? userNames[userId] || 'Unknown' : 'Unknown';

  const isAssignee = task?.assigned_to === userId;
  const isSO = !!userId && !!task && (
    // Check via review case — SO is stored on the case
    false // We don't have SO id here directly, handled by RLS
  );

  // Permission: assignee, SO, or super_user can act
  // We rely on RLS for actual enforcement; UI gates are best-effort
  const canAct = !!task && !!userId;
  const isInProgress = reviewCaseStatus === 'in_progress';

  const canStart = canAct && task?.status === 'pending' && isInProgress;
  const canComplete = canAct && task?.status === 'in_progress' && isInProgress;
  const canReopen = canAct && task?.status === 'completed' && isInProgress;

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['review-tasks', reviewCaseId] });
    queryClient.invalidateQueries({ queryKey: ['task-work-notes', task?.id] });
    queryClient.invalidateQueries({ queryKey: ['review-case', reviewCaseId] });
  };

  const startTask = useMutation({
    mutationFn: async () => {
      if (!task || !userId) throw new Error('Missing task or user');

      const now = new Date().toISOString();

      // Update task status
      const { error } = await supabase
        .from('review_tasks')
        .update({
          status: 'in_progress',
          started_at: now,
          updated_by: userId,
        } as any)
        .eq('id', task.id);
      if (error) throw error;

      // Auto work note
      await supabase.from('task_work_notes').insert({
        task_id: task.id,
        content: `Task started by ${currentUserName}`,
        note_type: 'status_change',
        created_by: userId,
      } as any);

      // Audit log
      await supabase.from('audit_log').insert({
        user_id: userId,
        action: 'TASK_STARTED',
        resource_type: 'review_tasks',
        resource_id: task.id,
        details: { review_case_id: reviewCaseId, task_title: task.title },
      } as any);
    },
    onSuccess: () => {
      invalidateQueries();
      toast({ title: 'Task started' });
    },
    onError: (err: any) => {
      console.error('Failed to start task:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const completeTask = useMutation({
    mutationFn: async () => {
      if (!task || !userId) throw new Error('Missing task or user');

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('review_tasks')
        .update({
          status: 'completed',
          completed_at: now,
          completed_by: userId,
          updated_by: userId,
        } as any)
        .eq('id', task.id);
      if (error) throw error;

      // Auto work note
      await supabase.from('task_work_notes').insert({
        task_id: task.id,
        content: `Task completed by ${currentUserName}`,
        note_type: 'status_change',
        created_by: userId,
      } as any);

      // Audit log
      await supabase.from('audit_log').insert({
        user_id: userId,
        action: 'TASK_COMPLETED',
        resource_type: 'review_tasks',
        resource_id: task.id,
        details: { review_case_id: reviewCaseId, task_title: task.title },
      } as any);
    },
    onSuccess: () => {
      invalidateQueries();
      toast({ title: 'Task completed' });
    },
    onError: (err: any) => {
      console.error('Failed to complete task:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const reopenTask = useMutation({
    mutationFn: async (reason: string) => {
      if (!task || !userId) throw new Error('Missing task or user');
      if (!reason.trim()) throw new Error('Reason is required');

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('review_tasks')
        .update({
          status: 'in_progress',
          reopened_at: now,
          reopened_by: userId,
          reopened_reason: reason.trim(),
          completed_at: null,
          completed_by: null,
          updated_by: userId,
        } as any)
        .eq('id', task.id);
      if (error) throw error;

      // Auto work note
      await supabase.from('task_work_notes').insert({
        task_id: task.id,
        content: `Task reopened by ${currentUserName}. Reason: ${reason.trim()}`,
        note_type: 'reopen_reason',
        created_by: userId,
      } as any);

      // Audit log
      await supabase.from('audit_log').insert({
        user_id: userId,
        action: 'TASK_REOPENED',
        resource_type: 'review_tasks',
        resource_id: task.id,
        details: { review_case_id: reviewCaseId, task_title: task.title, reason: reason.trim() },
      } as any);
    },
    onSuccess: () => {
      invalidateQueries();
      toast({ title: 'Task reopened' });
    },
    onError: (err: any) => {
      console.error('Failed to reopen task:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return {
    startTask,
    completeTask,
    reopenTask,
    canStart,
    canComplete,
    canReopen,
    isInProgress,
  };
}
