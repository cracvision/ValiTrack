import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget notification sender.
 * Calls the send-notification Edge Function but never blocks the caller.
 * Errors are logged to console only.
 */
export async function sendNotification(params: {
  notification_type: string;
  recipient_user_id: string;
  data: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.functions.invoke("send-notification", {
      body: {
        notification_type: params.notification_type,
        recipient_user_id: params.recipient_user_id,
        data: params.data,
        triggered_by: session.user.id,
      },
    });
  } catch (error) {
    // Fire-and-forget: log but don't block the user's action
    console.error("[sendNotification] failed:", error);
  }
}

// Notification type constants for type-safe usage from frontend
export const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: "task_assigned",
  TASK_REASSIGNED: "task_reassigned",
  REVIEW_INITIATED: "review_initiated",
  REVIEW_STATUS_CHANGED: "review_status_changed",
  SIGNOFF_REQUESTED: "signoff_requested",
  APPROVAL_PENDING: "approval_pending",
  TASK_DUE_APPROACHING: "task_due_approaching",
  TASK_OVERDUE: "task_overdue",
  REVIEW_PERIOD_APPROACHING: "review_period_approaching",
  COMPLETION_DEADLINE_APPROACHING: "completion_deadline_approaching",
  REVIEW_PERIOD_OVERDUE: "review_period_overdue",
  ESCALATION_TASK_OVERDUE: "escalation_task_overdue",
  ESCALATION_DEADLINE_OVERDUE: "escalation_deadline_overdue",
  DIGEST_SO_WEEKLY: "digest_so_weekly",
  DIGEST_QA_WEEKLY: "digest_qa_weekly",
  ACCOUNT_WELCOME: "account_welcome",
  ACCOUNT_PASSWORD_CHANGED: "account_password_changed",
} as const;
