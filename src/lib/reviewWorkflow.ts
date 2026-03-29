import type { ReviewStatus, ReviewLevel, ReviewConclusion } from '@/types';

export interface TransitionRule {
  to: ReviewStatus;
  requiredRoles: string[];
  requiresReason?: boolean;
  requiresConclusion?: boolean;
  requiresESignature?: boolean;
  label: string;
  labelKey: string;
}

const CANCEL_TRANSITION: TransitionRule = {
  to: 'cancelled',
  requiredRoles: ['super_user'],
  label: 'Cancel review',
  labelKey: 'reviewCases.actions.cancelReview',
  requiresReason: true,
  requiresESignature: true,
};

const TRANSITION_MAP: Record<ReviewStatus, TransitionRule[]> = {
  draft: [
    {
      to: 'plan_review',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Submit for review',
      labelKey: 'reviews.actions.submitForReview',
    },
    CANCEL_TRANSITION,
  ],

  plan_review: [
    {
      to: 'plan_approval',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Submit for approval',
      labelKey: 'reviews.actions.submitForApproval',
    },
    {
      to: 'draft',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Return to draft',
      labelKey: 'reviews.actions.returnToDraft',
      requiresReason: true,
    },
    CANCEL_TRANSITION,
  ],

  plan_approval: [
    {
      to: 'approved_for_execution',
      requiredRoles: ['quality_assurance', 'super_user'],
      label: 'Approve plan',
      labelKey: 'reviews.actions.approvePlan',
      requiresESignature: true,
    },
    {
      to: 'plan_review',
      requiredRoles: ['quality_assurance', 'super_user'],
      label: 'Return for review',
      labelKey: 'reviews.actions.returnForReview',
      requiresReason: true,
    },
    CANCEL_TRANSITION,
  ],

  approved_for_execution: [
    {
      to: 'in_progress',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Start execution',
      labelKey: 'reviews.actions.startExecution',
    },
    CANCEL_TRANSITION,
  ],

  in_progress: [
    {
      to: 'execution_review',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Submit for final review',
      labelKey: 'reviews.actions.submitForFinalReview',
    },
    {
      to: 'approved_for_execution',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Step back',
      labelKey: 'reviews.actions.stepBack',
      requiresReason: true,
    },
    CANCEL_TRANSITION,
  ],

  execution_review: [
    {
      to: 'approved',
      requiredRoles: ['quality_assurance', 'super_user'],
      label: 'Approve review',
      labelKey: 'reviews.actions.approveReview',
      requiresConclusion: true,
      requiresESignature: true,
    },
    {
      to: 'rejected',
      requiredRoles: ['quality_assurance', 'super_user'],
      label: 'Reject',
      labelKey: 'reviews.actions.reject',
      requiresReason: true,
      requiresESignature: true,
    },
    {
      to: 'in_progress',
      requiredRoles: ['quality_assurance', 'super_user'],
      label: 'Return for corrections',
      labelKey: 'reviews.actions.returnForCorrections',
      requiresReason: true,
    },
    CANCEL_TRANSITION,
  ],

  approved: [],

  rejected: [
    {
      to: 'draft',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Restart review',
      labelKey: 'reviews.actions.restartReview',
    },
    {
      to: 'in_progress',
      requiredRoles: ['system_owner', 'super_user'],
      label: 'Return to execution',
      labelKey: 'reviews.actions.returnToExecution',
    },
    CANCEL_TRANSITION,
  ],

  cancelled: [],
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
  if (riskLevel === 'High') return '2';
  return '1';
}

// Status display configuration — includes BOTH new and old states for historical display
export const REVIEW_STATUS_CONFIG: Record<string, { label: string; labelKey: string; className: string }> = {
  // === NEW STATES ===
  draft: { label: 'Draft', labelKey: 'reviews.status.draft', className: 'bg-muted text-muted-foreground border-border' },
  plan_review: { label: 'Plan review', labelKey: 'reviews.status.plan_review', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-neutral-800 dark:text-blue-400 dark:border-neutral-700' },
  plan_approval: { label: 'Plan approval', labelKey: 'reviews.status.plan_approval', className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-neutral-800 dark:text-purple-400 dark:border-neutral-700' },
  approved_for_execution: { label: 'Approved for execution', labelKey: 'reviews.status.approved_for_execution', className: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-neutral-800 dark:text-teal-400 dark:border-neutral-700' },
  in_progress: { label: 'In progress', labelKey: 'reviews.status.in_progress', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-neutral-800 dark:text-amber-400 dark:border-neutral-700' },
  execution_review: { label: 'Execution review', labelKey: 'reviews.status.execution_review', className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-neutral-800 dark:text-orange-400 dark:border-neutral-700' },
  approved: { label: 'Approved', labelKey: 'reviews.status.approved', className: 'bg-green-50 text-green-700 border-green-200 dark:bg-neutral-800 dark:text-green-400 dark:border-neutral-700' },
  rejected: { label: 'Rejected', labelKey: 'reviews.status.rejected', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-neutral-800 dark:text-red-400 dark:border-neutral-700' },
  cancelled: { label: 'Cancelled', labelKey: 'reviews.status.cancelled', className: 'bg-neutral-100 text-neutral-500 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-600' },
  // === OLD STATES (historical transition display only) ===
  in_preparation: { label: 'In preparation', labelKey: 'reviews.status.in_preparation', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-neutral-800 dark:text-blue-400 dark:border-neutral-700' },
  under_review: { label: 'Under review', labelKey: 'reviews.status.under_review', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-neutral-800 dark:text-amber-400 dark:border-neutral-700' },
};

// Stepper phase groupings (5 visual phases for 8 states)
export interface StepperPhase {
  key: string;
  labelKey: string;
  states: string[];
}

export const STEPPER_PHASES: StepperPhase[] = [
  { key: 'planning', labelKey: 'reviews.phases.planning', states: ['draft', 'plan_review'] },
  { key: 'plan_approval', labelKey: 'reviews.phases.planApproval', states: ['plan_approval'] },
  { key: 'execution', labelKey: 'reviews.phases.execution', states: ['approved_for_execution', 'in_progress'] },
  { key: 'final_review', labelKey: 'reviews.phases.finalReview', states: ['execution_review'] },
  { key: 'closure', labelKey: 'reviews.phases.closure', states: ['approved'] },
];

// Review level display
export const REVIEW_LEVEL_CONFIG: Record<ReviewLevel, { label: string; description: string }> = {
  '1': { label: 'Level 1', description: 'Basic — checklist-based review' },
  '2': { label: 'Level 2', description: 'Intermediate — documentation quality evaluation' },
  '3': { label: 'Level 3', description: 'Detailed — comprehensive with challenge testing' },
};

// Conclusion display
export const CONCLUSION_CONFIG: Record<ReviewConclusion, { label: string; className: string }> = {
  remains_validated: { label: 'Remains validated', className: 'bg-green-50 text-green-700 dark:bg-neutral-800 dark:text-green-400' },
  requires_remediation: { label: 'Requires remediation', className: 'bg-amber-50 text-amber-700 dark:bg-neutral-800 dark:text-amber-400' },
  requires_revalidation: { label: 'Requires revalidation', className: 'bg-red-50 text-red-700 dark:bg-neutral-800 dark:text-red-400' },
};
