import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import type { Finding, FindingSeverity, FindingCategory, FindingSource, FindingStatus, RiskRating, CapaStatus } from '@/types/findings';

export function useFindings(reviewCaseId: string | undefined) {
  return useQuery({
    queryKey: ['findings', reviewCaseId],
    queryFn: async (): Promise<Finding[]> => {
      if (!reviewCaseId) return [];
      const { data, error } = await supabase
        .from('findings' as any)
        .select('*')
        .eq('review_case_id', reviewCaseId)
        .eq('is_deleted', false)
        .order('severity', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Finding[];
    },
    enabled: !!reviewCaseId,
  });
}

export function useFindingsCount(reviewCaseId: string | undefined) {
  const { data: findings = [] } = useFindings(reviewCaseId);
  const aiIdentified = findings.filter(f => f.status === 'ai_identified').length;
  const confirmed = findings.filter(f => ['confirmed', 'in_progress'].includes(f.status)).length;
  const closed = findings.filter(f => f.status === 'closed').length;
  const dismissed = findings.filter(f => f.status === 'dismissed').length;
  return { total: findings.length, aiIdentified, confirmed, closed, dismissed };
}

interface CreateFindingInput {
  review_case_id: string;
  task_id?: string | null;
  evidence_file_id?: string | null;
  ai_task_result_id?: string | null;
  title: string;
  title_es?: string | null;
  description: string;
  description_es?: string | null;
  severity: FindingSeverity;
  category: FindingCategory;
  source: FindingSource;
  ai_finding_index?: number | null;
  regulation_reference?: string | null;
  sop_reference?: string | null;
  risk_probability?: RiskRating | null;
  risk_impact?: RiskRating | null;
  risk_level?: RiskRating | null;
  status: FindingStatus;
  action_description?: string | null;
  action_responsible?: string | null;
  action_due_date?: string | null;
  capa_required?: boolean;
  capa_status?: CapaStatus | null;
}

export function useCreateFinding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateFindingInput) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('findings' as any)
        .insert({ ...input, created_by: user.id } as any)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: input.source === 'ai_identified' ? 'FINDING_AUTO_CREATED' : 'FINDING_MANUAL_CREATED',
        resource_type: 'finding',
        resource_id: (data as any).id,
        details: { title: input.title, severity: input.severity, source: input.source, review_case_id: input.review_case_id },
      });

      return data as unknown as Finding;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['findings', input.review_case_id] });
    },
  });
}

export function useConfirmFinding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ findingId, reviewCaseId, updates }: {
      findingId: string;
      reviewCaseId: string;
      updates: Partial<Finding>;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const hasAction = !!updates.action_description;
      const now = new Date().toISOString();
      const payload: any = {
        ...updates,
        status: hasAction ? 'in_progress' : 'confirmed',
        confirmed_by: user.id,
        confirmed_at: now,
        updated_by: user.id,
      };

      const { error } = await supabase
        .from('findings' as any)
        .update(payload)
        .eq('id', findingId);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'FINDING_CONFIRMED',
        resource_type: 'finding',
        resource_id: findingId,
        details: { review_case_id: reviewCaseId, status: payload.status },
      });
    },
    onSuccess: (_, { reviewCaseId }) => {
      queryClient.invalidateQueries({ queryKey: ['findings', reviewCaseId] });
      toast({ title: 'Finding confirmed' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

export function useDismissFinding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ findingId, reviewCaseId, justification }: {
      findingId: string;
      reviewCaseId: string;
      justification: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('findings' as any)
        .update({
          status: 'dismissed',
          dismissal_justification: justification,
          dismissed_by: user.id,
          dismissed_at: now,
          updated_by: user.id,
        } as any)
        .eq('id', findingId);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'FINDING_DISMISSED',
        resource_type: 'finding',
        resource_id: findingId,
        details: { review_case_id: reviewCaseId, justification },
      });
    },
    onSuccess: (_, { reviewCaseId }) => {
      queryClient.invalidateQueries({ queryKey: ['findings', reviewCaseId] });
      toast({ title: 'Finding dismissed' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

export function useCloseFinding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ findingId, reviewCaseId, resolutionNotes, capaReference, capaSystem, capaStatus }: {
      findingId: string;
      reviewCaseId: string;
      resolutionNotes: string;
      capaReference?: string;
      capaSystem?: string;
      capaStatus?: CapaStatus;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const now = new Date().toISOString();
      const payload: any = {
        status: 'closed',
        resolution_notes: resolutionNotes,
        resolved_by: user.id,
        resolved_at: now,
        updated_by: user.id,
      };
      if (capaReference) payload.capa_reference = capaReference;
      if (capaSystem) payload.capa_system = capaSystem;
      if (capaStatus) payload.capa_status = capaStatus;

      const { error } = await supabase
        .from('findings' as any)
        .update(payload)
        .eq('id', findingId);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'FINDING_CLOSED',
        resource_type: 'finding',
        resource_id: findingId,
        details: { review_case_id: reviewCaseId, resolution_notes: resolutionNotes, capa_reference: capaReference },
      });
    },
    onSuccess: (_, { reviewCaseId }) => {
      queryClient.invalidateQueries({ queryKey: ['findings', reviewCaseId] });
      toast({ title: 'Finding closed' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

export function useReopenFinding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ findingId, reviewCaseId, fromStatus }: {
      findingId: string;
      reviewCaseId: string;
      fromStatus: FindingStatus;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const newStatus = fromStatus === 'dismissed' ? 'ai_identified' : 'confirmed';
      const { error } = await supabase
        .from('findings' as any)
        .update({
          status: newStatus,
          updated_by: user.id,
          // Clear resolution fields if reopening from closed
          ...(fromStatus === 'closed' ? { resolved_by: null, resolved_at: null, resolution_notes: null } : {}),
          // Clear dismissal fields if reopening from dismissed
          ...(fromStatus === 'dismissed' ? { dismissed_by: null, dismissed_at: null, dismissal_justification: null } : {}),
        } as any)
        .eq('id', findingId);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'FINDING_REOPENED',
        resource_type: 'finding',
        resource_id: findingId,
        details: { review_case_id: reviewCaseId, from_status: fromStatus, to_status: newStatus },
      });
    },
    onSuccess: (_, { reviewCaseId }) => {
      queryClient.invalidateQueries({ queryKey: ['findings', reviewCaseId] });
      toast({ title: 'Finding reopened' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

export function useUpdateFinding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ findingId, reviewCaseId, updates }: {
      findingId: string;
      reviewCaseId: string;
      updates: Partial<Finding>;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('findings' as any)
        .update({ ...updates, updated_by: user.id } as any)
        .eq('id', findingId);
      if (error) throw error;

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'FINDING_UPDATED',
        resource_type: 'finding',
        resource_id: findingId,
        details: { review_case_id: reviewCaseId, changed_fields: Object.keys(updates) },
      });
    },
    onSuccess: (_, { reviewCaseId }) => {
      queryClient.invalidateQueries({ queryKey: ['findings', reviewCaseId] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

// Global findings query for /findings page
export function useAllFindings(filters?: {
  severity?: FindingSeverity;
  status?: FindingStatus;
  source?: FindingSource;
  category?: FindingCategory;
  capaRequired?: boolean;
}) {
  return useQuery({
    queryKey: ['findings-global', filters],
    queryFn: async (): Promise<(Finding & { system_name?: string; system_identifier?: string; review_title?: string })[]> => {
      let query = supabase
        .from('findings' as any)
        .select('*, review_cases!inner(title, system_id, frozen_system_snapshot)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (filters?.severity) query = query.eq('severity', filters.severity);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.source) query = query.eq('source', filters.source);
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.capaRequired !== undefined) query = query.eq('capa_required', filters.capaRequired);

      const { data, error } = await query;
      if (error) throw error;

      return ((data || []) as any[]).map(f => {
        const rc = f.review_cases;
        const snapshot = rc?.frozen_system_snapshot as any;
        return {
          ...f,
          system_name: snapshot?.name,
          system_identifier: snapshot?.system_identifier,
          review_title: rc?.title,
        } as Finding & { system_name?: string; system_identifier?: string; review_title?: string };
      });
    },
  });
}
