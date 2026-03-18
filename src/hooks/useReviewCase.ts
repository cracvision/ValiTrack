import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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
        review_level: data.review_level,
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

      // Insert transition record
      const { error: transError } = await supabase
        .from('review_case_transitions')
        .insert({
          review_case_id: input.reviewCaseId,
          from_status: input.fromStatus,
          to_status: input.toStatus,
          reason: input.reason || null,
          transitioned_by: user.id,
        } as any);

      if (transError) throw transError;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['review-case', input.reviewCaseId] });
      queryClient.invalidateQueries({ queryKey: ['review-cases'] });
      queryClient.invalidateQueries({ queryKey: ['review-transitions', input.reviewCaseId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-systems'] });
    },
  });
}
