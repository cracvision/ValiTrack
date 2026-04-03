import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { notifySignoffRequested } from '@/lib/notificationWiring';
import type { SystemProfile, ProfileApprovalStatus } from '@/types';

interface UseSystemProfilesReturn {
  systems: SystemProfile[];
  loading: boolean;
  addSystem: (system: SystemProfile) => Promise<boolean>;
  updateSystem: (system: SystemProfile) => Promise<boolean>;
  deleteSystem: (id: string) => Promise<boolean>;
  transitionApprovalStatus: (profileId: string, fromStatus: ProfileApprovalStatus, toStatus: ProfileApprovalStatus, reason?: string) => Promise<boolean>;
  refetch: () => void;
}

function rowToSystemProfile(row: any): SystemProfile {
  return {
    id: row.id,
    name: row.name,
    system_identifier: row.system_identifier,
    system_environment: row.system_environment,
    gamp_category: row.gamp_category,
    description: row.description ?? '',
    intended_use: row.intended_use ?? '',
    gxp_classification: row.gxp_classification,
    risk_level: row.risk_level,
    status: row.status,
    vendor_name: row.vendor_name ?? '',
    vendor_contact: row.vendor_contact ?? '',
    vendor_contract_ref: row.vendor_contract_ref ?? '',
    owner_id: row.owner_id ?? '',
    system_owner_id: row.system_owner_id ?? '',
    system_admin_id: row.system_admin_id ?? '',
    qa_id: row.qa_id ?? '',
    business_owner_id: row.business_owner_id ?? undefined,
    it_manager_id: row.it_manager_id ?? undefined,
    initial_validation_date: row.initial_validation_date,
    last_review_period_end: row.last_review_period_end ?? null,
    review_period_months: row.review_period_months,
    next_review_date: row.next_review_date,
    completion_window_days: row.completion_window_days ?? 90,
    approval_status: row.approval_status ?? 'draft',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function fetchSystemProfiles(): Promise<SystemProfile[]> {
  const { data, error } = await supabase
    .from('system_profiles')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(rowToSystemProfile);
}

export function useSystemProfiles(): UseSystemProfilesReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const { data: systems = [], isLoading } = useQuery({
    queryKey: ['system-profiles', user?.id],
    queryFn: fetchSystemProfiles,
    enabled: !!user,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['system-profiles'] });
  }, [queryClient]);

  const addSystem = useCallback(async (system: SystemProfile): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('system_profiles').insert({
        id: system.id,
        name: system.name,
        system_identifier: system.system_identifier,
        system_environment: system.system_environment,
        gamp_category: system.gamp_category,
        description: system.description,
        intended_use: system.intended_use,
        gxp_classification: system.gxp_classification,
        risk_level: system.risk_level,
        status: system.status,
        vendor_name: system.vendor_name,
        vendor_contact: system.vendor_contact,
        vendor_contract_ref: system.vendor_contract_ref,
        owner_id: system.owner_id,
        system_owner_id: system.system_owner_id,
        system_admin_id: system.system_admin_id,
        qa_id: system.qa_id,
        it_manager_id: system.it_manager_id ?? null,
        business_owner_id: system.business_owner_id ?? null,
        initial_validation_date: system.initial_validation_date,
        last_review_period_end: system.last_review_period_end ?? null,
        review_period_months: system.review_period_months,
        next_review_date: system.next_review_date,
        completion_window_days: system.completion_window_days,
        approval_status: 'draft',
        created_by: user.id,
      });
      if (error) {
        if (error.code === '23505' && error.message?.includes('idx_unique_system_identifier')) {
          throw new Error('DUPLICATE_IDENTIFIER');
        }
        throw error;
      }
      invalidate();
      return true;
    } catch (err: any) {
      console.error('Failed to create system profile:', err);
      const isDuplicate = err.message === 'DUPLICATE_IDENTIFIER' || (err.code === '23505' && err.message?.includes('idx_unique_system_identifier'));
      toastRef.current({
        title: isDuplicate ? 'Duplicate identifier' : 'Error creating system',
        description: isDuplicate ? 'DUPLICATE_IDENTIFIER' : (err.message ?? 'Could not save the system profile.'),
        variant: 'destructive',
      });
      return false;
    }
  }, [user, invalidate]);

  const updateSystem = useCallback(async (system: SystemProfile): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('system_profiles').update({
        name: system.name,
        system_identifier: system.system_identifier,
        system_environment: system.system_environment,
        gamp_category: system.gamp_category,
        description: system.description,
        intended_use: system.intended_use,
        gxp_classification: system.gxp_classification,
        risk_level: system.risk_level,
        status: system.status,
        vendor_name: system.vendor_name,
        vendor_contact: system.vendor_contact,
        vendor_contract_ref: system.vendor_contract_ref,
        owner_id: system.owner_id,
        system_owner_id: system.system_owner_id,
        system_admin_id: system.system_admin_id,
        qa_id: system.qa_id,
        it_manager_id: system.it_manager_id ?? null,
        business_owner_id: system.business_owner_id ?? null,
        initial_validation_date: system.initial_validation_date,
        last_review_period_end: system.last_review_period_end ?? null,
        review_period_months: system.review_period_months,
        next_review_date: system.next_review_date,
        completion_window_days: system.completion_window_days,
        updated_by: user.id,
      }).eq('id', system.id);
      if (error) {
        if (error.code === '23505' && error.message?.includes('idx_unique_system_identifier')) {
          throw new Error('DUPLICATE_IDENTIFIER');
        }
        throw error;
      }
      invalidate();
      return true;
    } catch (err: any) {
      console.error('Failed to update system profile:', err);
      const isDuplicate = err.message === 'DUPLICATE_IDENTIFIER' || (err.code === '23505' && err.message?.includes('idx_unique_system_identifier'));
      toastRef.current({
        title: isDuplicate ? 'Duplicate identifier' : 'Error updating system',
        description: isDuplicate ? 'DUPLICATE_IDENTIFIER' : (err.message ?? 'Could not update the system profile.'),
        variant: 'destructive',
      });
      return false;
    }
  }, [user, invalidate]);

  const deleteSystem = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('system_profiles').update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      }).eq('id', id);
      if (error) throw error;
      invalidate();
      return true;
    } catch (err: any) {
      console.error('Failed to delete system profile:', err);
      toastRef.current({
        title: 'Error deleting system',
        description: err.message ?? 'Could not delete the system profile.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, invalidate]);

  const transitionApprovalStatus = useCallback(async (
    profileId: string,
    fromStatus: ProfileApprovalStatus,
    toStatus: ProfileApprovalStatus,
    reason?: string
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      // 1. Update approval_status
      const { error: updateError } = await supabase
        .from('system_profiles')
        .update({
          approval_status: toStatus,
          updated_by: user.id,
        } as any)
        .eq('id', profileId);
      if (updateError) throw updateError;

      // 2. Insert transition record
      const { error: transError } = await supabase
        .from('profile_transitions')
        .insert({
          system_profile_id: profileId,
          from_status: fromStatus,
          to_status: toStatus,
          reason: reason ?? '',
          transitioned_by: user.id,
          created_by: user.id,
        } as any);
      if (transError) throw transError;

      // 3. Audit log for the transition
      const auditActionMap: Record<string, string> = {
        'in_review': 'PROFILE_SUBMITTED_FOR_REVIEW',
        'approved': 'PROFILE_APPROVED',
      };
      let auditAction = auditActionMap[toStatus];
      if (toStatus === 'draft' && fromStatus === 'in_review') {
        auditAction = 'PROFILE_RETURNED_TO_DRAFT';
      } else if (toStatus === 'draft' && fromStatus === 'approved') {
        auditAction = 'PROFILE_REVISED';
      }
      if (auditAction) {
        await supabase.from('audit_log').insert({
          user_id: user.id,
          action: auditAction,
          resource_type: 'system_profile',
          resource_id: profileId,
          details: { from_status: fromStatus, to_status: toStatus, reason: reason ?? '' },
        } as any);
      }

      // 4. If transitioning to 'in_review': create sign-off requests
      if (toStatus === 'in_review') {
        // Soft-delete ALL existing signoffs for this profile via SECURITY DEFINER RPC
        const { error: cleanupError } = await supabase.rpc('cleanup_profile_signoffs', {
          p_system_profile_id: profileId,
        });
        if (cleanupError) throw new Error(`Failed to clean up old sign-offs: ${cleanupError.message}`);

        const profile = systems.find(s => s.id === profileId);
        if (profile) {
          const signoffRoles = [
            { role: 'system_administrator', userId: profile.system_admin_id },
            { role: 'quality_assurance', userId: profile.qa_id },
            { role: 'business_owner', userId: profile.business_owner_id },
            { role: 'it_manager', userId: profile.it_manager_id },
          ];

          const validSignoffs = signoffRoles.filter(s => s.userId && s.userId.trim() !== '');

          for (const { role, userId: requestedUserId } of validSignoffs) {
            const { error: insertError } = await supabase.from('profile_signoffs').insert({
              system_profile_id: profileId,
              requested_role: role,
              requested_user_id: requestedUserId,
              status: 'pending',
              created_by: user.id,
            } as any);
            if (insertError) throw new Error(`Failed to create sign-off for ${role}: ${insertError.message}`);
          }

          // 🔔 Notify signoff_requested for profile review
          const signoffUserIds = validSignoffs.map(s => s.userId!);
          notifySignoffRequested({
            signoffUserIds,
            systemName: profile.name,
            signoffPhase: 'Profile Review',
            signoffPhaseEs: 'Revisión del Perfil',
            resourceType: 'system_profile',
            resourceId: profileId,
          });
        }
      }

      // 5. If transitioning to 'draft' from 'in_review': reset all signoffs
      if (toStatus === 'draft' && fromStatus === 'in_review') {
        const { error: draftCleanupError } = await supabase
          .from('profile_signoffs')
          .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            deleted_by: user.id,
            updated_by: user.id,
          } as any)
          .eq('system_profile_id', profileId)
          .eq('is_deleted', false);
        if (draftCleanupError) throw new Error(`Failed to clean up sign-offs on return to draft: ${draftCleanupError.message}`);
      }

      invalidate();
      return true;
    } catch (err: any) {
      console.error('Failed to transition approval status:', err);
      toastRef.current({
        title: 'Error updating status',
        description: err.message ?? 'Could not update the approval status.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, invalidate, systems]);

  return { systems, loading: isLoading, addSystem, updateSystem, deleteSystem, transitionApprovalStatus, refetch: invalidate };
}
