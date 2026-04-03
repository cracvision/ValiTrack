import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { notifyApprovalPending } from '@/lib/notificationWiring';
import type { ReviewSignoff } from '@/types';

interface UseReviewSignoffsOptions {
  reviewCaseId: string | undefined;
  phase: string;
  systemOwnerId?: string;
  initiatedBy?: string;
}

export function useReviewSignoffs({ reviewCaseId, phase, systemOwnerId, initiatedBy }: UseReviewSignoffsOptions) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const isSignoffPhase = phase === 'plan_review' || phase === 'execution_review';

  const { data: signoffs, isLoading, refetch } = useQuery({
    queryKey: ['review-signoffs', reviewCaseId, phase],
    queryFn: async (): Promise<ReviewSignoff[]> => {
      if (!reviewCaseId) return [];
      const { data, error } = await supabase
        .from('review_signoffs')
        .select('*')
        .eq('review_case_id', reviewCaseId)
        .eq('phase', phase)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ReviewSignoff[];
    },
    enabled: !!reviewCaseId && isSignoffPhase,
  });

  const totalCount = signoffs?.length || 0;
  const approvedCount = signoffs?.filter(s => s.status === 'approved').length || 0;
  const objectedCount = signoffs?.filter(s => s.status === 'objected').length || 0;
  const pendingCount = signoffs?.filter(s => s.status === 'pending').length || 0;
  const completedCount = approvedCount + objectedCount;
  const allDecided = totalCount > 0 && signoffs!.every(s => s.status !== 'pending');
  const allApproved = totalCount > 0 && signoffs!.every(s => s.status === 'approved');
  const hasObjections = signoffs?.some(s => s.status === 'objected') || false;

  // SO can advance only if ALL decided AND NONE objected
  const canAdvance = allApproved;

  // Current user's signoff — exclude SO (system_owner_id AND initiated_by)
  const mySignoff = signoffs?.find(s => s.requested_user_id === userId);
  const isSystemOwner = userId === systemOwnerId || userId === initiatedBy;
  const canSignOff = !!mySignoff && mySignoff.status === 'pending' && !isSystemOwner;

  const submitDecision = useMutation({
    mutationFn: async ({ decision, comments }: { decision: 'approved' | 'objected'; comments: string }) => {
      if (!mySignoff || !userId) throw new Error('No signoff request found');
      if (decision === 'objected' && !comments.trim()) {
        throw new Error('Comments are required when raising objections');
      }
      const { error } = await supabase
        .from('review_signoffs')
        .update({
          status: decision,
          completed_at: new Date().toISOString(),
          comments: comments.trim(),
          updated_by: userId,
        } as any)
        .eq('id', mySignoff.id);
      if (error) throw error;

      // Audit log entry
      await supabase.from('audit_log').insert({
        user_id: userId,
        action: decision === 'approved' ? 'SIGNOFF_APPROVED' : 'SIGNOFF_OBJECTED',
        resource_type: 'review_signoffs',
        resource_id: mySignoff.id,
        details: {
          review_case_id: reviewCaseId,
          phase,
          comments: comments.trim(),
        },
      } as any);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['review-signoffs'] });
      queryClient.invalidateQueries({ queryKey: ['review-case', reviewCaseId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-systems'] });
    },
  });

  return {
    signoffs: signoffs || [],
    isLoading,
    allDecided,
    allApproved,
    hasObjections,
    canAdvance,
    pendingCount,
    approvedCount,
    objectedCount,
    completedCount,
    totalCount,
    mySignoff,
    canSignOff,
    submitDecision,
    refetch,
  };
}
