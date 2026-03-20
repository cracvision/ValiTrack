import type { ProfileApprovalStatus } from '@/types';

export interface ProfileTransitionRule {
  to: ProfileApprovalStatus;
  requiredRoles: string[];
  label: string;
  labelKey: string;
  requiresReason?: boolean;
}

export const PROFILE_TRANSITION_MAP: Record<ProfileApprovalStatus, ProfileTransitionRule[]> = {
  draft: [
    {
      to: 'in_review',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Submit for review',
      labelKey: 'systemProfiles.approval.actions.submitForReview',
    },
  ],
  in_review: [
    {
      to: 'approved',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Approve profile',
      labelKey: 'systemProfiles.approval.actions.approve',
    },
    {
      to: 'draft',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Return to draft',
      labelKey: 'systemProfiles.approval.actions.returnToDraft',
      requiresReason: true,
    },
  ],
  approved: [
    {
      to: 'draft',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Revise profile',
      labelKey: 'systemProfiles.approval.actions.revise',
      requiresReason: true,
    },
  ],
};

export const PROFILE_APPROVAL_STATUS_CONFIG: Record<ProfileApprovalStatus, {
  label: string;
  labelKey: string;
  className: string;
}> = {
  draft: {
    label: 'Draft',
    labelKey: 'systemProfiles.approval.status.draft',
    className: 'border border-muted-foreground/30 bg-muted text-muted-foreground',
  },
  in_review: {
    label: 'In Review',
    labelKey: 'systemProfiles.approval.status.inReview',
    className: 'border border-blue-200 bg-blue-50 text-blue-700',
  },
  approved: {
    label: 'Approved',
    labelKey: 'systemProfiles.approval.status.approved',
    className: 'border border-green-200 bg-green-50 text-green-700',
  },
};

export function getProfileTransitions(
  currentStatus: ProfileApprovalStatus,
  userRoles: string[]
): ProfileTransitionRule[] {
  const rules = PROFILE_TRANSITION_MAP[currentStatus] || [];
  return rules.filter(rule =>
    rule.requiredRoles.some(r => userRoles.includes(r))
  );
}
