/**
 * Phase 2 — Event-driven notification wiring helpers.
 * These functions are called fire-and-forget after primary actions succeed.
 * They NEVER throw — errors are logged to console only.
 */
import { supabase } from '@/integrations/supabase/client';
import { sendNotification, NOTIFICATION_TYPES } from '@/lib/notifications';

// ── Status Labels for review_status_changed ──────────────────
const STATUS_LABELS: Record<string, Record<string, string>> = {
  en: {
    draft: 'Draft',
    plan_review: 'Plan Review',
    plan_approval: 'Plan Approval',
    approved_for_execution: 'Approved for Execution',
    in_progress: 'In Progress',
    execution_review: 'Under Final Review',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
  },
  es: {
    draft: 'Borrador',
    plan_review: 'Revisión del Plan',
    plan_approval: 'Aprobación del Plan',
    approved_for_execution: 'Aprobado para Ejecución',
    in_progress: 'En Progreso',
    execution_review: 'En Revisión Final',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    cancelled: 'Cancelado',
  },
};

// ── Role label mapping ──────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  system_owner: 'System Owner',
  system_administrator: 'System Administrator',
  quality_assurance: 'Quality Assurance',
  business_owner: 'Business Owner',
  it_manager: 'IT Manager',
};

// ── 4.1 / 4.3: Review Initiated (after task generation) ─────
export async function notifyReviewInitiated(params: {
  reviewCaseId: string;
  systemName: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
}): Promise<void> {
  try {
    // Query generated tasks grouped by assignee
    const { data: tasks } = await supabase
      .from('review_tasks')
      .select('assigned_to, task_group')
      .eq('review_case_id', params.reviewCaseId)
      .eq('is_deleted', false);

    if (!tasks || tasks.length === 0) return;

    // Group tasks by assignee
    const assigneeMap = new Map<string, { count: number; role: string }>();
    for (const t of tasks) {
      const existing = assigneeMap.get(t.assigned_to);
      if (existing) {
        existing.count++;
      } else {
        // Infer role from task_group
        const role = inferRoleFromTaskGroup(t.task_group);
        assigneeMap.set(t.assigned_to, { count: 1, role });
      }
    }

    // Send one notification per unique assignee
    for (const [assigneeId, info] of assigneeMap) {
      sendNotification({
        notification_type: NOTIFICATION_TYPES.REVIEW_INITIATED,
        recipient_user_id: assigneeId,
        data: {
          system_name: params.systemName,
          period_start: params.periodStart,
          period_end: params.periodEnd,
          recipient_role: ROLE_LABELS[info.role] || info.role,
          task_count: info.count,
          due_date: params.dueDate,
          review_case_id: params.reviewCaseId,
        },
      });
    }
  } catch (err) {
    console.error('[notifyReviewInitiated] failed:', err);
  }
}

function inferRoleFromTaskGroup(taskGroup: string): string {
  const groupRoleMap: Record<string, string> = {
    INIT: 'system_owner',
    ITSM: 'system_administrator',
    QMS: 'quality_assurance',
    SEC: 'system_administrator',
    INFRA: 'system_administrator',
    DOC: 'system_administrator',
    AI_EVAL: 'system_administrator',
    APPR: 'system_owner',
  };
  return groupRoleMap[taskGroup] || 'system_administrator';
}

// ── 4.2: Task Reassigned ────────────────────────────────────
export function notifyTaskReassigned(params: {
  taskTitle: string;
  taskId: string;
  reviewCaseId: string;
  systemName: string;
  previousAssigneeId: string;
  previousAssigneeName: string;
  newAssigneeId: string;
  newAssigneeName: string;
  reason: string;
}): void {
  // Notify new assignee
  sendNotification({
    notification_type: NOTIFICATION_TYPES.TASK_REASSIGNED,
    recipient_user_id: params.newAssigneeId,
    data: {
      task_title: params.taskTitle,
      task_id: params.taskId,
      review_case_id: params.reviewCaseId,
      system_name: params.systemName,
      previous_assignee: params.previousAssigneeName,
      new_assignee: params.newAssigneeName,
      reason: params.reason,
      is_new_assignee: true,
    },
  });

  // Notify previous assignee
  sendNotification({
    notification_type: NOTIFICATION_TYPES.TASK_REASSIGNED,
    recipient_user_id: params.previousAssigneeId,
    data: {
      task_title: params.taskTitle,
      task_id: params.taskId,
      review_case_id: params.reviewCaseId,
      system_name: params.systemName,
      previous_assignee: params.previousAssigneeName,
      new_assignee: params.newAssigneeName,
      reason: params.reason,
      is_new_assignee: false,
    },
  });
}

// ── 4.4: Review Status Changed ──────────────────────────────
export function notifyReviewStatusChanged(params: {
  reviewCaseId: string;
  systemName: string;
  fromStatus: string;
  toStatus: string;
  reason?: string;
  recipientUserIds: string[];
}): void {
  for (const recipientId of params.recipientUserIds) {
    sendNotification({
      notification_type: NOTIFICATION_TYPES.REVIEW_STATUS_CHANGED,
      recipient_user_id: recipientId,
      data: {
        system_name: params.systemName,
        previous_status: STATUS_LABELS.en[params.fromStatus] || params.fromStatus,
        new_status: STATUS_LABELS.en[params.toStatus] || params.toStatus,
        previous_status_es: STATUS_LABELS.es[params.fromStatus] || params.fromStatus,
        new_status_es: STATUS_LABELS.es[params.toStatus] || params.toStatus,
        reason: params.reason || '',
        review_case_id: params.reviewCaseId,
      },
    });
  }
}

// ── 4.5: Sign-off Requested ─────────────────────────────────
export function notifySignoffRequested(params: {
  signoffUserIds: string[];
  systemName: string;
  signoffPhase: string;
  signoffPhaseEs: string;
  resourceType: 'review_case' | 'system_profile';
  resourceId: string;
}): void {
  for (const userId of params.signoffUserIds) {
    sendNotification({
      notification_type: NOTIFICATION_TYPES.SIGNOFF_REQUESTED,
      recipient_user_id: userId,
      data: {
        system_name: params.systemName,
        signoff_phase: params.signoffPhase,
        signoff_phase_es: params.signoffPhaseEs,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
      },
    });
  }
}

// ── 4.6: Approval Pending ───────────────────────────────────
export function notifyApprovalPending(params: {
  recipientUserId: string;
  systemName: string;
  transitionLabel: string;
  transitionLabelEs: string;
  reviewCaseId: string;
}): void {
  sendNotification({
    notification_type: NOTIFICATION_TYPES.APPROVAL_PENDING,
    recipient_user_id: params.recipientUserId,
    data: {
      system_name: params.systemName,
      transition_label: params.transitionLabel,
      transition_label_es: params.transitionLabelEs,
      review_case_id: params.reviewCaseId,
    },
  });
}

// ── Helpers ─────────────────────────────────────────────────
/** Collect unique non-empty role user IDs from a review case */
export function getReviewCaseStakeholders(rc: {
  system_owner_id: string;
  system_admin_id: string;
  qa_id: string;
  business_owner_id?: string | null;
  it_manager_id?: string | null;
}): string[] {
  const ids = new Set<string>();
  if (rc.system_owner_id) ids.add(rc.system_owner_id);
  if (rc.system_admin_id) ids.add(rc.system_admin_id);
  if (rc.qa_id) ids.add(rc.qa_id);
  if (rc.business_owner_id) ids.add(rc.business_owner_id);
  if (rc.it_manager_id) ids.add(rc.it_manager_id);
  ids.delete('');
  return Array.from(ids);
}
