import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { SystemProfile, ReviewStatus as CaseStatus } from '@/types';

export type ReviewStatusType =
  | 'no_review'
  | 'compliant'
  | 'approaching'
  | 'in_progress'
  | 'pending_approval'
  | 'overdue';

export interface DashboardSystem extends SystemProfile {
  reviewStatus: ReviewStatusType;
  daysUntilDue: number;
  countdownLabel: string;
  userRelationship: string[];
}

function computeReviewStatus(system: SystemProfile): { status: ReviewStatusType; daysUntilDue: number } {
  if (!system.validation_date || !system.next_review_date) {
    return { status: 'no_review', daysUntilDue: 0 };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const nextReview = new Date(system.next_review_date);
  nextReview.setHours(0, 0, 0, 0);
  const diffMs = nextReview.getTime() - now.getTime();
  const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntilDue < 0) return { status: 'overdue', daysUntilDue };
  if (daysUntilDue <= 30) return { status: 'approaching', daysUntilDue };
  return { status: 'compliant', daysUntilDue };
}

function getCountdownLabel(status: ReviewStatusType, daysUntilDue: number): string {
  if (status === 'no_review') return '';
  if (status === 'overdue') return `Overdue by ${Math.abs(daysUntilDue)} days`;
  if (status === 'approaching') return `Due in ${daysUntilDue} days`;
  if (status === 'compliant') {
    const months = Math.floor(daysUntilDue / 30);
    return months > 0 ? `${months} months away` : `${daysUntilDue} days away`;
  }
  return '';
}

function getUserRelationships(system: SystemProfile, userId: string): string[] {
  const relationships: string[] = [];
  if (system.system_owner_id === userId) relationships.push('system_owner');
  if (system.system_admin_id === userId) relationships.push('system_administrator');
  if (system.qa_id === userId) relationships.push('quality_assurance');
  if (system.it_manager_id === userId) relationships.push('it_manager');
  if (system.owner_id === userId) relationships.push('business_owner');
  return relationships;
}

const STATUS_ORDER: Record<ReviewStatusType, number> = {
  overdue: 0,
  approaching: 1,
  in_progress: 2,
  pending_approval: 3,
  no_review: 4,
  compliant: 5,
};

export function useDashboardSystems() {
  const { user, roles } = useAuth();
  const userId = user?.id;
  const isSuperUser = roles.includes('super_user');

  return useQuery({
    queryKey: ['dashboard-systems', userId],
    queryFn: async (): Promise<DashboardSystem[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('system_profiles')
        .select('*')
        .eq('is_deleted', false)
        .order('next_review_date', { ascending: true });

      if (error) throw error;
      if (!data) return [];

      // Map rows to SystemProfile, then filter by role assignment
      const allSystems: SystemProfile[] = data.map((row: any) => ({
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
        it_manager_id: row.it_manager_id ?? undefined,
        validation_date: row.validation_date,
        review_period_months: row.review_period_months,
        next_review_date: row.next_review_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      // Super users see all systems; others see only assigned systems
      const filtered = isSuperUser
        ? allSystems
        : allSystems.filter((s) => getUserRelationships(s, userId).length > 0);

      const dashboardSystems: DashboardSystem[] = filtered.map((s) => {
        const { status, daysUntilDue } = computeReviewStatus(s);
        return {
          ...s,
          reviewStatus: status,
          daysUntilDue,
          countdownLabel: getCountdownLabel(status, daysUntilDue),
          userRelationship: isSuperUser ? ['super_user'] : getUserRelationships(s, userId),
        };
      });

      // Sort: overdue first, then approaching, etc.
      dashboardSystems.sort((a, b) => {
        const orderDiff = STATUS_ORDER[a.reviewStatus] - STATUS_ORDER[b.reviewStatus];
        if (orderDiff !== 0) return orderDiff;
        return a.daysUntilDue - b.daysUntilDue;
      });

      return dashboardSystems;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}
