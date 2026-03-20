import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { buildTaskPayloads } from '@/lib/taskGeneration';
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
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['review-case', input.reviewCaseId] });
      queryClient.invalidateQueries({ queryKey: ['review-cases'] });
      queryClient.invalidateQueries({ queryKey: ['review-transitions', input.reviewCaseId] });
      queryClient.invalidateQueries({ queryKey: ['review-signoffs', input.reviewCaseId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-systems'] });
    },
  });
}
