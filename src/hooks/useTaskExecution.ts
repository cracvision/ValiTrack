import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useResolveUserNames } from '@/hooks/useResolveUserNames';
import { toast } from '@/hooks/use-toast';
import { notifyTaskReassigned } from '@/lib/notificationWiring';
import type { ReviewTask } from '@/types';

interface UseTaskExecutionOptions {
  task: ReviewTask | undefined;
  reviewCaseId: string;
  reviewCaseStatus: string;
  systemOwnerId?: string;
  systemName?: string;
}

const MODIFIABLE_STATUSES = ['in_progress', 'approved_for_execution'];

export function useTaskExecution({ task, reviewCaseId, reviewCaseStatus, systemOwnerId, systemName }: UseTaskExecutionOptions) {
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
  const isModifiable = MODIFIABLE_STATUSES.includes(reviewCaseStatus);

  const canStart = canExecute && task?.status === 'pending' && isInProgress && task?.task_group !== 'AI_EVAL';
  const canComplete = canExecute && (task?.status === 'in_progress' || task?.status === 'ai_complete') && isInProgress;
  const canReopen = canReopen_ && (task?.status === 'completed' || task?.status === 'not_applicable') && isInProgress;

  // AI queue: only for AI_EVAL tasks in pending status
  const canQueueAi = !!task && !!userId
    && task.task_group === 'AI_EVAL'
    && task.status === 'pending'
    && isInProgress
    && (isAssignee || isSystemOwner || isSuperUser);

  // N/A can be marked from pending or in_progress, by assignee/SO/SU, when review case allows modification
  const canMarkNA = !!task && !!userId
    && (isAssignee || isSuperUser || isSystemOwner)
    && (task.status === 'pending' || task.status === 'in_progress')
    && isModifiable;

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
      // AI auto-population: if completing an AI_EVAL task, extract findings
      if (task.task_group === 'AI_EVAL') {
        try {
          const { data: aiResult } = await supabase
            .from('ai_task_results' as any)
            .select('*')
            .eq('task_id', task.id)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (aiResult) {
            // Check for duplicates
            const { count: existingCount } = await supabase
              .from('findings' as any)
              .select('id', { count: 'exact', head: true })
              .eq('ai_task_result_id', (aiResult as any).id)
              .eq('is_deleted', false);

            if ((existingCount || 0) === 0) {
              const analysis = (aiResult as any).analysis_result as any;
              const criticalFindings = analysis?.critical_findings || [];

              const severityMap: Record<string, string> = {
                'CRITICAL': 'critical', 'MAJOR': 'major', 'MINOR': 'minor', 'OBSERVATION': 'observation',
              };

              const categoryFromTask = (title: string): string => {
                const lower = title.toLowerCase();
                if (lower.includes('incident')) return 'incident_trend';
                if (lower.includes('change')) return 'change_control';
                if (lower.includes('access') || lower.includes('user')) return 'access_control';
                if (lower.includes('audit')) return 'audit_trail';
                if (lower.includes('backup')) return 'backup_restore';
                if (lower.includes('integrity')) return 'data_integrity';
                if (lower.includes('training')) return 'training';
                if (lower.includes('performance')) return 'performance';
                if (lower.includes('vendor')) return 'vendor';
                if (lower.includes('document') || lower.includes('sop')) return 'documentation';
                if (lower.includes('config')) return 'configuration';
                return 'other';
              };

              for (let i = 0; i < criticalFindings.length; i++) {
                const cf = criticalFindings[i];
                const severity = severityMap[cf.severity] || 'observation';
                await supabase.from('findings' as any).insert({
                  review_case_id: reviewCaseId,
                  task_id: task.id,
                  ai_task_result_id: (aiResult as any).id,
                  title: cf.description?.substring(0, 200) || `Finding ${i + 1}`,
                  description: cf.description || '',
                  severity,
                  category: categoryFromTask(task.title),
                  source: 'ai_identified',
                  ai_finding_index: i,
                  regulation_reference: cf.regulatory_reference || null,
                  status: 'ai_identified',
                  created_by: userId,
                } as any);

                await supabase.from('audit_log').insert({
                  user_id: userId,
                  action: 'FINDING_AUTO_CREATED',
                  resource_type: 'finding',
                  resource_id: reviewCaseId,
                  details: { task_id: task.id, ai_task_result_id: (aiResult as any).id, finding_index: i, severity },
                });
              }
            }
          }
        } catch (err) {
          console.error('Failed to auto-populate findings:', err);
        }
      }
    },
    onSuccess: () => {
      invalidateQueries();
      queryClient.invalidateQueries({ queryKey: ['findings', reviewCaseId] });
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
      const wasNA = task.status === 'not_applicable';

      // Reopening from N/A → pending; from completed → in_progress
      const newStatus = wasNA ? 'pending' : 'in_progress';

      const updatePayload: Record<string, any> = {
        status: newStatus,
        reopened_at: now,
        reopened_by: userId,
        reopened_reason: reason.trim(),
        completed_at: null,
        completed_by: null,
        updated_by: userId,
      };

      // Clear N/A columns when reopening from N/A
      if (wasNA) {
        updatePayload.na_reason = null;
        updatePayload.na_marked_by = null;
        updatePayload.na_marked_at = null;
      }

      const { error } = await supabase
        .from('review_tasks')
        .update(updatePayload as any)
        .eq('id', task.id);
      if (error) throw error;

      const auditAction = wasNA ? 'TASK_REOPENED_FROM_NA' : 'TASK_REOPENED';
      const noteContent = wasNA
        ? `Task reopened from N/A by ${currentUserName}. Reason: ${reason.trim()}`
        : `Task reopened by ${currentUserName}. Reason: ${reason.trim()}`;

      await supabase.from('task_work_notes').insert({
        task_id: task.id,
        content: noteContent,
        note_type: 'reopen_reason',
        created_by: userId,
      } as any);

      await supabase.from('audit_log').insert({
        user_id: userId,
        action: auditAction,
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

  const markTaskNA = useMutation({
    mutationFn: async (justification: string) => {
      if (!task || !userId) throw new Error('Missing task or user');
      if (justification.trim().length < 10) throw new Error('Justification must be at least 10 characters');

      const now = new Date().toISOString();

      const { error } = await supabase
        .from('review_tasks')
        .update({
          status: 'not_applicable',
          na_reason: justification.trim(),
          na_marked_by: userId,
          na_marked_at: now,
          updated_by: userId,
        } as any)
        .eq('id', task.id)
        .eq('is_deleted', false);
      if (error) throw error;

      await supabase.from('task_work_notes').insert({
        task_id: task.id,
        content: `Task marked as N/A by ${currentUserName}. Justification: ${justification.trim()}`,
        note_type: 'na_justification',
        created_by: userId,
        updated_by: userId,
      } as any);

      await supabase.from('audit_log').insert({
        user_id: userId,
        action: 'TASK_MARKED_NA',
        resource_type: 'review_task',
        resource_id: task.id,
        details: {
          task_title: task.title,
          task_code: task.template_id,
          review_case_id: reviewCaseId,
          justification: justification.trim(),
          previous_status: task.status,
        },
      } as any);
    },
    onSuccess: () => {
      invalidateQueries();
      toast({ title: 'Task marked as N/A' });
    },
    onError: (err: any) => {
      console.error('Failed to mark task as N/A:', err);
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

      // 🔔 Notify both old and new assignee
      notifyTaskReassigned({
        taskTitle: task.title,
        taskId: task.id,
        reviewCaseId,
        systemName: systemName || '',
        previousAssigneeId: task.assigned_to,
        previousAssigneeName: oldAssigneeName,
        newAssigneeId,
        newAssigneeName,
        reason: reason.trim(),
      });
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

  const queueAiTask = useMutation({
    mutationFn: async () => {
      if (!task || !userId) throw new Error('Missing task or user');

      const { data, error } = await supabase.rpc('queue_ai_task', {
        p_task_id: task.id,
        p_user_id: userId,
      } as any);

      if (error) throw error;
      const result = data as unknown as { success: boolean; error?: string };
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to queue task for AI analysis');
      }
    },
    onSuccess: () => {
      invalidateQueries();
      queryClient.invalidateQueries({ queryKey: ['ai-task-result', task?.id] });
      toast({ title: 'Task queued for AI analysis' });
    },
    onError: (err: any) => {
      console.error('Failed to queue AI task:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return {
    startTask,
    completeTask,
    reopenTask,
    reassignTask,
    markTaskNA,
    queueAiTask,
    canStart,
    canComplete,
    canReopen,
    canMarkNA,
    canQueueAi,
    canAddNotes,
    canReassign,
    isReadOnly,
    isInProgress,
    isAssignee,
    isSystemOwner,
    isSuperUser,
  };
}
