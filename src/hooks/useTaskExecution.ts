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
  systemOwnerId?: string;
}

export function useTaskExecution({ task, reviewCaseId, reviewCaseStatus, systemOwnerId }: UseTaskExecutionOptions) {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const { data: userNames = {} } = useResolveUserNames(userId ? [userId] : []);
  const currentUserName = userId ? userNames[userId] || 'Unknown' : 'Unknown';

  const isAssignee = task?.assigned_to === userId;
  const isSuperUser = roles.includes('super_user');
  const isSystemOwner = !!userId && !!systemOwnerId && systemOwnerId === userId;

  const canExecute = !!task && !!userId && (isAssignee || isSuperUser);
  const canReopen_ = !!task && !!userId && (isSystemOwner || isSuperUser);
  const canAddNotes = !!task && !!userId && (isAssignee || isSuperUser);
  const canReassign = !!task && !!userId && (isSystemOwner || isSuperUser);

  const isInProgress = reviewCaseStatus === 'in_progress';

  const canStart = canExecute && task?.status === 'pending' && isInProgress;
  const canComplete = canExecute && task?.status === 'in_progress' && isInProgress;
  const canReopen = canReopen_ && task?.status === 'completed' && isInProgress;

  const isReadOnly = !canExecute && !canReopen_ && !isSuperUser;

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['review-tasks', reviewCaseId] });
    queryClient.invalidateQueries({ queryKey: ['task-work-notes', task?.id] });
    queryClient.invalidateQueries({ queryKey: ['review-case', reviewCaseId] });
    queryClient.invalidateQueries({ queryKey: ['review-case-phases', reviewCaseId] });
    queryClient.invalidateQueries({ queryKey: ['task-phase-unlocked'] });
    queryClient.invalidateQueries({ queryKey: ['task-checkoffs', task?.id] });
  };

  const startTask = useMutation({
    mutationFn: async () => {
      if (!task || !userId) throw new Error('Missing task or user');

      // Phase guard: check if prior phases are complete
      const { data: phaseCheck, error: phaseError } = await supabase.rpc('check_task_phase_unlocked', {
        p_task_id: task.id,
      } as any);
      if (phaseError) throw phaseError;
      const phaseResult = phaseCheck as unknown as { unlocked: boolean; error?: string };
      if (!phaseResult?.unlocked) {
        throw new Error('Cannot start this task. All tasks in prior execution phases must be completed first.');
      }

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('review_tasks')
        .update({
          status: 'in_progress',
          started_at: now,
          updated_by: userId,
        } as any)
        .eq('id', task.id);
      if (error) throw error;

      await supabase.from('task_work_notes').insert({
        task_id: task.id,
        content: `Task started by ${currentUserName}`,
        note_type: 'status_change',
        created_by: userId,
      } as any);

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

      await supabase.from('task_work_notes').insert({
        task_id: task.id,
        content: `Task completed by ${currentUserName}`,
        note_type: 'status_change',
        created_by: userId,
      } as any);

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

      await supabase.from('task_work_notes').insert({
        task_id: task.id,
        content: `Task reopened by ${currentUserName}. Reason: ${reason.trim()}`,
        note_type: 'reopen_reason',
        created_by: userId,
      } as any);

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

  const reassignTask = useMutation({
    mutationFn: async ({ newAssigneeId, newAssigneeName, reason }: { newAssigneeId: string; newAssigneeName: string; reason: string }) => {
      if (!task || !userId) throw new Error('Missing task or user');
      if (!reason.trim()) throw new Error('Reason is required');

      const oldAssigneeName = task.assigned_to_name || 'Unknown';
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('review_tasks')
        .update({
          assigned_to: newAssigneeId,
          reassigned_at: now,
          reassigned_by: userId,
          reassigned_from: task.assigned_to,
          reassignment_reason: reason.trim(),
          updated_by: userId,
        } as any)
        .eq('id', task.id);
      if (error) throw error;

      await supabase.from('task_work_notes').insert({
        task_id: task.id,
        content: `Task reassigned from ${oldAssigneeName} to ${newAssigneeName} by ${currentUserName}. Reason: ${reason.trim()}`,
        note_type: 'reassignment',
        created_by: userId,
      } as any);

      await supabase.from('audit_log').insert({
        user_id: userId,
        action: 'TASK_REASSIGNED',
        resource_type: 'review_tasks',
        resource_id: task.id,
        details: {
          review_case_id: reviewCaseId,
          task_title: task.title,
          from_user: task.assigned_to,
          to_user: newAssigneeId,
          reason: reason.trim(),
        },
      } as any);
    },
    onSuccess: () => {
      invalidateQueries();
      toast({ title: 'Task reassigned' });
    },
    onError: (err: any) => {
      console.error('Failed to reassign task:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return {
    startTask,
    completeTask,
    reopenTask,
    reassignTask,
    canStart,
    canComplete,
    canReopen,
    canAddNotes,
    canReassign,
    isReadOnly,
    isInProgress,
    isAssignee,
    isSystemOwner,
    isSuperUser,
  };
}
