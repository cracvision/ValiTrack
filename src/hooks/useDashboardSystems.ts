import { useQuery, keepPreviousData } from '@tanstack/react-query';
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
  actualReviewStatus?: CaseStatus;
  daysUntilDue: number;
  countdownLabel: string;
  userRelationship: string[];
  activeReviewCaseId?: string;
  activeReviewCaseStatus?: CaseStatus;
  signoffSummary?: { total_required: number; total_completed: number; has_objections: boolean };
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
  if (status === 'overdue') {
    const absDays = Math.abs(daysUntilDue);
    return `Overdue by ${absDays} ${absDays === 1 ? 'day' : 'days'}`;
  }
  if (status === 'approaching') return `Due in ${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'}`;
  if (status === 'compliant') {
    const months = Math.floor(daysUntilDue / 30);
    if (months > 0) return `${months} ${months === 1 ? 'month' : 'months'} away`;
    return `${daysUntilDue} ${daysUntilDue === 1 ? 'day' : 'days'} away`;
  }
  return '';
}

function getUserRelationships(system: SystemProfile, userId: string): string[] {
  const relationships: string[] = [];
  if (system.system_owner_id === userId) relationships.push('system_owner');
  if (system.system_admin_id === userId) relationships.push('system_administrator');
  if (system.qa_id === userId) relationships.push('quality_assurance');
  if (system.it_manager_id === userId) relationships.push('it_manager');
  if (system.business_owner_id === userId) relationships.push('business_owner');
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
    queryKey: ['dashboard-systems', userId, isSuperUser],
    queryFn: async (): Promise<DashboardSystem[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('system_profiles')
        .select('*')
        .eq('is_deleted', false)
        .order('next_review_date', { ascending: true });

      if (error) throw error;
      if (!data) return [];

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
        business_owner_id: row.business_owner_id ?? undefined,
        it_manager_id: row.it_manager_id ?? undefined,
        validation_date: row.validation_date,
        review_period_months: row.review_period_months,
        next_review_date: row.next_review_date,
        approval_status: row.approval_status ?? 'draft',
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      const systemIds = allSystems.map(s => s.id);
      let reviewCaseMap: Record<string, { id: string; status: string }> = {};

      if (systemIds.length > 0) {
        const { data: cases } = await supabase
          .from('review_cases')
          .select('id, system_id, status, business_owner_id, system_owner_id, qa_id, initiated_by')
          .eq('is_deleted', false)
          .in('system_id', systemIds)
          .order('created_at', { ascending: false });

        if (cases) {
          for (const c of cases as any[]) {
            if (!reviewCaseMap[c.system_id]) {
              reviewCaseMap[c.system_id] = { id: c.id, status: c.status };
            }
          }
        }
      }

      // Fetch signoff summaries in parallel for cases in plan_review/execution_review
      const signoffPhases = ['plan_review', 'execution_review'];
      const casesNeedingSignoffs = Object.entries(reviewCaseMap)
        .filter(([, c]) => signoffPhases.includes(c.status))
        .map(([systemId, c]) => ({ systemId, caseId: c.id, phase: c.status }));

      const signoffMap: Record<string, { total_required: number; total_completed: number; has_objections: boolean }> = {};

      if (casesNeedingSignoffs.length > 0) {
        const results = await Promise.all(
          casesNeedingSignoffs.map(async ({ systemId, caseId, phase }) => {
            const { data } = await supabase.rpc('get_signoff_summary', {
              p_review_case_id: caseId,
              p_phase: phase,
            });
            return { systemId, summary: data?.[0] || null };
          })
        );
        for (const { systemId, summary } of results) {
          if (summary) {
            signoffMap[systemId] = summary;
          }
        }
      }

      const dashboardSystems: DashboardSystem[] = allSystems.map((s) => {
        const activeCase = reviewCaseMap[s.id];
        const { status: dateStatus, daysUntilDue } = computeReviewStatus(s);

        let reviewStatus: ReviewStatusType;

        if (activeCase) {
          const cs = activeCase.status as CaseStatus;
          if (['draft', 'plan_review', 'plan_approval', 'approved_for_execution', 'in_progress', 'rejected'].includes(cs)) {
            reviewStatus = 'in_progress';
          } else if (cs === 'execution_review') {
            reviewStatus = 'pending_approval';
          } else if (cs === 'approved') {
            reviewStatus = daysUntilDue >= 0 ? 'compliant' : 'overdue';
          } else {
            reviewStatus = dateStatus;
          }
        } else {
          reviewStatus = dateStatus;
        }

        return {
          ...s,
          reviewStatus,
          actualReviewStatus: activeCase?.status as CaseStatus | undefined,
          daysUntilDue,
          countdownLabel: getCountdownLabel(reviewStatus, daysUntilDue),
          userRelationship: isSuperUser
            ? ['super_user', ...getUserRelationships(s, userId)]
            : getUserRelationships(s, userId),
          activeReviewCaseId: activeCase?.id,
          activeReviewCaseStatus: activeCase?.status as CaseStatus | undefined,
          signoffSummary: signoffMap[s.id],
        };
      });

      dashboardSystems.sort((a, b) => {
        const orderDiff = STATUS_ORDER[a.reviewStatus] - STATUS_ORDER[b.reviewStatus];
        if (orderDiff !== 0) return orderDiff;
        return a.daysUntilDue - b.daysUntilDue;
      });

      return dashboardSystems;
    },
    enabled: !!userId && roles.length > 0,
    staleTime: 2 * 60 * 1000,
  });
}
