import type { ReviewStatus, ReviewLevel, ReviewConclusion } from '@/types';

export interface TransitionRule {
  to: ReviewStatus;
  requiredRoles: string[];
  requiresReason?: boolean;
  requiresConclusion?: boolean;
}

const TRANSITION_MAP: Record<ReviewStatus, TransitionRule[]> = {
  draft: [
    { to: 'in_preparation', requiredRoles: ['system_owner', 'super_user'] },
  ],
  in_preparation: [
    { to: 'in_progress', requiredRoles: ['system_owner', 'super_user'] },
    { to: 'draft', requiredRoles: ['system_owner', 'super_user'] },
  ],
  in_progress: [
    { to: 'under_review', requiredRoles: ['system_owner', 'super_user'] },
    { to: 'in_preparation', requiredRoles: ['system_owner', 'super_user'] },
  ],
  under_review: [
    { to: 'approved', requiredRoles: ['quality_assurance', 'super_user'], requiresConclusion: true },
    { to: 'rejected', requiredRoles: ['quality_assurance', 'super_user'], requiresReason: true },
  ],
  approved: [],
  rejected: [
    { to: 'draft', requiredRoles: ['system_owner', 'super_user'] },
  ],
};

export function getValidTransitions(currentStatus: ReviewStatus, userRoles: string[]): TransitionRule[] {
  const rules = TRANSITION_MAP[currentStatus] || [];
  return rules.filter(rule =>
    rule.requiredRoles.some(role => userRoles.includes(role))
  );
}

export function canTransition(currentStatus: ReviewStatus, targetStatus: ReviewStatus, userRoles: string[]): boolean {
  return getValidTransitions(currentStatus, userRoles).some(rule => rule.to === targetStatus);
}

export function getTransitionRule(currentStatus: ReviewStatus, targetStatus: ReviewStatus): TransitionRule | undefined {
  return TRANSITION_MAP[currentStatus]?.find(rule => rule.to === targetStatus);
}

// Review Depth Matrix — calculates review level from Risk × GAMP
export function calculateReviewLevel(riskLevel: string, gampCategory: string): ReviewLevel {
  if (gampCategory === '5') return riskLevel === 'Low' ? '2' : '3';
  if (gampCategory === '4') {
    if (riskLevel === 'High') return '3';
    if (riskLevel === 'Medium') return '2';
    return '1';
  }
  // GAMP Cat 3 and Cat 1
  if (riskLevel === 'High') return '2';
  return '1';
}

// Status display configuration
export const REVIEW_STATUS_CONFIG: Record<ReviewStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-border' },
  in_preparation: { label: 'In preparation', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: 'In progress', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  under_review: { label: 'Under review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
};

// Review level display
export const REVIEW_LEVEL_CONFIG: Record<ReviewLevel, { label: string; description: string }> = {
  '1': { label: 'Level 1', description: 'Basic — checklist-based review' },
  '2': { label: 'Level 2', description: 'Intermediate — documentation quality evaluation' },
  '3': { label: 'Level 3', description: 'Detailed — comprehensive with challenge testing' },
};

// Conclusion display
export const CONCLUSION_CONFIG: Record<ReviewConclusion, { label: string; className: string }> = {
  remains_validated: { label: 'Remains validated', className: 'bg-green-50 text-green-700' },
  requires_remediation: { label: 'Requires remediation', className: 'bg-amber-50 text-amber-700' },
  requires_revalidation: { label: 'Requires revalidation', className: 'bg-red-50 text-red-700' },
};

// Transition button labels (i18n keys)
export const TRANSITION_BUTTON_KEYS: Record<string, string> = {
  'draft->in_preparation': 'reviews.actions.startPreparation',
  'in_preparation->in_progress': 'reviews.actions.beginReview',
  'in_preparation->draft': 'reviews.actions.returnToDraft',
  'in_progress->under_review': 'reviews.actions.submitForApproval',
  'in_progress->in_preparation': 'reviews.actions.returnToPreparation',
  'under_review->approved': 'reviews.actions.approve',
  'under_review->rejected': 'reviews.actions.reject',
  'rejected->draft': 'reviews.actions.returnToDraft',
};
