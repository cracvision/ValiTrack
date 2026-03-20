import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ProfileSignoff } from '@/types';

interface UseProfileSignoffsOptions {
  systemProfileId: string | undefined;
}

export function useProfileSignoffs({ systemProfileId }: UseProfileSignoffsOptions) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const { data: signoffs, isLoading, refetch } = useQuery({
    queryKey: ['profile-signoffs', systemProfileId],
    queryFn: async (): Promise<ProfileSignoff[]> => {
      if (!systemProfileId) return [];
      const { data, error } = await supabase
        .from('profile_signoffs')
        .select('*')
        .eq('system_profile_id', systemProfileId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ProfileSignoff[];
    },
    enabled: !!systemProfileId,
  });

  const totalCount = signoffs?.length || 0;
  const approvedCount = signoffs?.filter(s => s.status === 'approved').length || 0;
  const objectedCount = signoffs?.filter(s => s.status === 'objected').length || 0;
  const pendingCount = signoffs?.filter(s => s.status === 'pending').length || 0;
  const completedCount = approvedCount + objectedCount;
  const allApproved = totalCount > 0 && signoffs!.every(s => s.status === 'approved');
  const hasObjections = signoffs?.some(s => s.status === 'objected') || false;
  const canAdvance = allApproved;

  const mySignoff = signoffs?.find(s => s.requested_user_id === userId);
  const canSignOff = !!mySignoff && mySignoff.status === 'pending';

  const submitDecision = useMutation({
    mutationFn: async ({ decision, comments }: { decision: 'approved' | 'objected'; comments: string }) => {
      if (!mySignoff || !userId) throw new Error('No signoff request found');
      if (decision === 'objected' && !comments.trim()) {
        throw new Error('Comments are required when raising objections');
      }
      const { error } = await supabase
        .from('profile_signoffs')
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
        action: decision === 'approved' ? 'PROFILE_SIGNOFF_APPROVED' : 'PROFILE_SIGNOFF_OBJECTED',
        resource_type: 'profile_signoffs',
        resource_id: mySignoff.id,
        details: {
          system_profile_id: systemProfileId,
          comments: comments.trim(),
        },
      } as any);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['profile-signoffs'] });
      queryClient.invalidateQueries({ queryKey: ['system-profiles'] });
    },
  });

  return {
    signoffs: signoffs || [],
    isLoading,
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
