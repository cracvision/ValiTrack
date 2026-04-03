import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { buildTaskPayloads } from '@/lib/taskGeneration';
import {
  notifyReviewInitiated,
  notifyReviewStatusChanged,
  notifySignoffRequested,
  getReviewCaseStakeholders,
} from '@/lib/notificationWiring';
import type { ReviewCase, ReviewStatus, ReviewConclusion } from '@/types';

export function useReviewCase(id: string | undefined) {
  return useQuery({
    queryKey: ['review-case', id],
    queryFn: async (): Promise<ReviewCase | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('review_cases')
        .select('*, system_profiles!review_cases_system_id_fkey(name, system_identifier)')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        system_id: data.system_id,
        title: data.title,
        review_period_start: data.review_period_start,
        review_period_end: data.review_period_end,
        review_level: data.review_level as ReviewCase['review_level'],
        due_date: data.due_date,
        period_end_date: (data as any).period_end_date ?? undefined,
        status: data.status as ReviewStatus,
        conclusion: (data.conclusion as ReviewConclusion) ?? undefined,
        conclusion_notes: data.conclusion_notes ?? undefined,
        frozen_system_snapshot: data.frozen_system_snapshot as Record<string, unknown>,
        initiated_by: data.initiated_by,
        system_owner_id: data.system_owner_id,
        system_admin_id: data.system_admin_id,
        qa_id: data.qa_id,
        business_owner_id: data.business_owner_id,
        it_manager_id: data.it_manager_id ?? undefined,
        completed_at: data.completed_at ?? undefined,
        cancelled_at: (data as any).cancelled_at ?? undefined,
        cancelled_by: (data as any).cancelled_by ?? undefined,
        cancellation_reason: (data as any).cancellation_reason ?? undefined,
        created_at: data.created_at,
        created_by: data.created_by,
        updated_at: data.updated_at,
        updated_by: data.updated_by ?? undefined,
        is_deleted: data.is_deleted,
        system_name: (data as any).system_profiles?.name,
        system_identifier: (data as any).system_profiles?.system_identifier,
      };
    },
    enabled: !!id,
  });
}

interface TransitionInput {
  reviewCaseId: string;
  fromStatus: ReviewStatus;
  toStatus: ReviewStatus;
  reason?: string;
  conclusion?: ReviewConclusion;
  conclusionNotes?: string;
}

export function useReviewCaseTransition() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TransitionInput) => {
      if (!user) throw new Error('Not authenticated');

      // Update case status
      const updatePayload: Record<string, unknown> = {
        status: input.toStatus,
        updated_by: user.id,
      };

      if (input.toStatus === 'approved') {
        updatePayload.conclusion = input.conclusion;
        updatePayload.conclusion_notes = input.conclusionNotes || null;
        updatePayload.completed_at = new Date().toISOString();
      }

      if (input.toStatus === 'cancelled') {
        updatePayload.cancelled_at = new Date().toISOString();
        updatePayload.cancelled_by = user.id;
        updatePayload.cancellation_reason = input.reason || null;
      }

      // Fetch the review case data for system profile update on approval
      let reviewCaseForUpdate: any = null;
      if (input.toStatus === 'approved') {
        const { data: rcData } = await supabase
          .from('review_cases')
          .select('system_id, period_end_date')
          .eq('id', input.reviewCaseId)
          .single();
        reviewCaseForUpdate = rcData;
      }

      const { error: updateError } = await supabase
        .from('review_cases')
        .update(updatePayload)
        .eq('id', input.reviewCaseId);

      if (updateError) throw updateError;

      // Build reason for the transition record
      let transitionReason: string | null = input.reason || null;
      if (input.toStatus === 'approved' && (input.conclusion || input.conclusionNotes)) {
        const conclusionLabel = input.conclusion?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';
        transitionReason = `Conclusion: ${conclusionLabel}.${input.conclusionNotes ? ' ' + input.conclusionNotes : ''}`;
      }

      // Insert transition record
      const { error: transError } = await supabase
        .from('review_case_transitions')
        .insert({
          review_case_id: input.reviewCaseId,
          from_status: input.fromStatus,
          to_status: input.toStatus,
          reason: transitionReason,
          transitioned_by: user.id,
        } as any);

      if (transError) throw transError;

      // Audit log for cancellation
      if (input.toStatus === 'cancelled') {
        const { data: rcSnap } = await supabase
          .from('review_cases')
          .select('frozen_system_snapshot')
          .eq('id', input.reviewCaseId)
          .single();

        const systemName = (rcSnap?.frozen_system_snapshot as any)?.name || '';

        await supabase.from('audit_log').insert({
          user_id: user.id,
          action: 'REVIEW_CASE_CANCELLED',
          resource_type: 'review_case',
          resource_id: input.reviewCaseId,
          details: {
            system_name: systemName,
            from_status: input.fromStatus,
            reason: input.reason || '',
          },
        });
      }

      // Create/reset signoffs when entering plan_review or execution_review
      if (input.toStatus === 'plan_review' || input.toStatus === 'execution_review') {
        // Fetch the review case to get role user IDs
        const { data: rc } = await supabase
          .from('review_cases')
          .select('system_admin_id, qa_id')
          .eq('id', input.reviewCaseId)
          .single();

        if (rc) {
          // Reset existing signoffs for this phase to pending
          await supabase
            .from('review_signoffs')
            .update({
              status: 'pending',
              completed_at: null,
              comments: '',
              updated_by: user.id,
            } as any)
            .eq('review_case_id', input.reviewCaseId)
            .eq('phase', input.toStatus);

          // Create signoff requests for SA and QA
          const signoffRoles = [
            { role: 'system_administrator', userId: rc.system_admin_id },
            { role: 'quality_assurance', userId: rc.qa_id },
          ];

          for (const { role, userId: requestedUserId } of signoffRoles) {
            if (requestedUserId && String(requestedUserId).trim() !== '') {
              await supabase.from('review_signoffs').upsert({
                review_case_id: input.reviewCaseId,
                phase: input.toStatus,
                requested_role: role,
                requested_user_id: requestedUserId,
                status: 'pending',
                created_by: user.id,
              } as any, {
                onConflict: 'review_case_id,phase,requested_user_id',
                ignoreDuplicates: true,
              });
            }
          }
        }
      }

      // Block 2: Task generation (approved_for_execution) — independent of Block 1
      if (input.toStatus === 'approved_for_execution') {
        // 1. Idempotency guard: verify no tasks already exist
        const { count: existingTaskCount } = await supabase
          .from('review_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('review_case_id', input.reviewCaseId)
          .eq('is_deleted', false);

        if (existingTaskCount === 0) {
          // 2. Fetch active templates
          const { data: templates, error: templatesError } = await supabase
            .from('task_templates')
            .select('*')
            .eq('is_active', true)
            .eq('is_deleted', false)
            .order('sort_order', { ascending: true });

          if (templatesError) throw templatesError;

          // 3. Fetch full review case for role IDs
          const { data: reviewCaseData, error: caseError } = await supabase
            .from('review_cases')
            .select('*')
            .eq('id', input.reviewCaseId)
            .single();

          if (caseError) throw caseError;

          // 4. Build payloads using utility (handles role fallbacks + due date calc)
          const taskPayloads = buildTaskPayloads(
            templates as any[],
            reviewCaseData as any,
            user.id
          );

          // 5. Batch insert
          if (taskPayloads.length > 0) {
            const { error: insertError } = await supabase
              .from('review_tasks')
              .insert(taskPayloads as any[]);

            if (insertError) throw insertError;
          }

          // 6. Audit log
          await supabase.from('audit_log').insert({
            user_id: user.id,
            action: 'TASKS_GENERATED',
            resource_type: 'review_tasks',
            resource_id: input.reviewCaseId,
            details: {
              review_case_id: input.reviewCaseId,
              tasks_generated: taskPayloads.length,
              review_level: reviewCaseData.review_level,
              triggered_by_transition: 'plan_approval → approved_for_execution',
            },
          });
        }
      }

      // Block 3: Auto-advance review cycle on approval
      if (input.toStatus === 'approved' && reviewCaseForUpdate?.period_end_date) {
        const periodEndDate = reviewCaseForUpdate.period_end_date;
        const systemId = reviewCaseForUpdate.system_id;

        // Fetch system profile for review_period_months
        const { data: sp } = await supabase
          .from('system_profiles')
          .select('review_period_months, next_review_date')
          .eq('id', systemId)
          .single();

        if (sp) {
          const newNextReview = new Date(periodEndDate);
          newNextReview.setMonth(newNextReview.getMonth() + sp.review_period_months);
          const newNextReviewDate = newNextReview.toISOString().split('T')[0];

          await supabase.from('system_profiles').update({
            last_review_period_end: periodEndDate,
            next_review_date: newNextReviewDate,
            updated_by: user.id,
          } as any).eq('id', systemId);

          // Audit log
          await supabase.from('audit_log').insert({
            user_id: user.id,
            action: 'REVIEW_CYCLE_ADVANCED',
            resource_type: 'system_profiles',
            resource_id: systemId,
            details: {
              review_case_id: input.reviewCaseId,
              previous_next_review_date: sp.next_review_date,
              new_last_review_period_end: periodEndDate,
              new_next_review_date: newNextReviewDate,
              review_period_months: sp.review_period_months,
            },
          });
        }
      }
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['review-case', input.reviewCaseId] });
      queryClient.invalidateQueries({ queryKey: ['review-cases'] });
      queryClient.invalidateQueries({ queryKey: ['review-transitions', input.reviewCaseId] });
      queryClient.invalidateQueries({ queryKey: ['review-signoffs', input.reviewCaseId] });
      queryClient.invalidateQueries({ queryKey: ['review-tasks', input.reviewCaseId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-systems'] });
      if (input.toStatus === 'approved' || input.toStatus === 'cancelled') {
        queryClient.invalidateQueries({ queryKey: ['system-profiles'] });
        queryClient.invalidateQueries({ queryKey: ['systems-for-review'] });
        queryClient.invalidateQueries({ queryKey: ['active-review-cases-guard'] });
      }
    },
  });
}
