import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ReviewCase, ReviewStatus, SystemProfile } from '@/types';

interface CreateReviewCaseInput {
  system: SystemProfile;
  title: string;
  review_period_start: string;
  review_period_end: string;
  review_level: string;
  due_date: string;
}

export function useReviewCases(filters?: { status?: ReviewStatus; systemId?: string }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['review-cases', filters],
    queryFn: async (): Promise<ReviewCase[]> => {
      let query = supabase
        .from('review_cases')
        .select('*, system_profiles!review_cases_system_id_fkey(name, system_identifier)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.systemId) {
        query = query.eq('system_id', filters.systemId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        system_id: row.system_id,
        title: row.title,
        review_period_start: row.review_period_start,
        review_period_end: row.review_period_end,
        review_level: row.review_level,
        due_date: row.due_date,
        period_end_date: row.period_end_date ?? undefined,
        status: row.status,
        conclusion: row.conclusion ?? undefined,
        conclusion_notes: row.conclusion_notes ?? undefined,
        frozen_system_snapshot: row.frozen_system_snapshot,
        initiated_by: row.initiated_by,
        system_owner_id: row.system_owner_id,
        system_admin_id: row.system_admin_id,
        qa_id: row.qa_id,
        business_owner_id: row.business_owner_id,
        it_manager_id: row.it_manager_id ?? undefined,
        completed_at: row.completed_at ?? undefined,
        created_at: row.created_at,
        created_by: row.created_by,
        updated_at: row.updated_at,
        updated_by: row.updated_by ?? undefined,
        is_deleted: row.is_deleted,
        system_name: row.system_profiles?.name,
        system_identifier: row.system_profiles?.system_identifier,
      }));
    },
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
}

export function useCreateReviewCase() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateReviewCaseInput): Promise<string> => {
      if (!user) throw new Error('Not authenticated');

      // Pre-insert duplicate guard
      const { count, error: checkError } = await supabase
        .from('review_cases')
        .select('*', { count: 'exact', head: true })
        .eq('system_id', input.system.id)
        .eq('is_deleted', false)
        .neq('status', 'approved');

      if (checkError) throw checkError;
      if ((count ?? 0) > 0) {
        throw new Error('DUPLICATE_ACTIVE_REVIEW');
      }

      const frozen_system_snapshot = {
        ...input.system,
        initial_validation_date: input.system.initial_validation_date,
        last_review_period_end: input.system.last_review_period_end ?? null,
        completion_window_days: input.system.completion_window_days ?? null,
      };
      const { data, error } = await supabase
        .from('review_cases')
        .insert({
          system_id: input.system.id,
          title: input.title,
          review_period_start: input.review_period_start,
          review_period_end: input.review_period_end,
          review_level: input.review_level,
          due_date: input.due_date,
          period_end_date: input.review_period_end,
          status: 'draft',
          frozen_system_snapshot,
          initiated_by: user.id,
          system_owner_id: input.system.system_owner_id,
          system_admin_id: input.system.system_admin_id,
          qa_id: input.system.qa_id,
          business_owner_id: input.system.business_owner_id || input.system.owner_id,
          it_manager_id: input.system.it_manager_id || null,
          created_by: user.id,
        } as any)
        .select('id')
        .single();

      if (error) throw error;

      // Insert initial transition
      const { error: transError } = await supabase
        .from('review_case_transitions')
        .insert({
          review_case_id: data.id,
          from_status: null,
          to_status: 'draft',
          transitioned_by: user.id,
        } as any);

      if (transError) throw transError;

      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-systems'] });
    },
  });
}
