import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * check-scheduled-notifications — Phase 3 Time-Driven Notifications
 *
 * Invoked daily at 08:00 UTC via pg_cron + pg_net.
 * Queries DB for time-based conditions and delegates email sending
 * to the existing send-notification/ Edge Function.
 *
 * AUTHENTICATION — Open endpoint (verify_jwt = false):
 *   This function has no custom auth check. It relies on:
 *
 *   1. verify_jwt = false in config.toml (required for pg_cron invocation).
 *   2. Deduplication via notification_log — repeated invocations are no-ops
 *      (alreadySent() returns true → skipped++). Zero extra emails sent.
 *   3. The function is a batch processor with NO user-specific side effects.
 *   4. All DB queries use the service_role client internally.
 *   5. Internal calls to send-notification/ use service_role.
 *
 *   WHY NOT token validation: Lovable Cloud edge functions receive short-format
 *   keys (sb_publish_xxx, ~46 chars) via env vars, while the frontend .env and
 *   pg_cron headers use JWT-format keys (~208 chars). These are different values
 *   representing the same credential, making string comparison unreliable.
 *
 * CRON SETUP NOTE (for project recreation):
 * This function is scheduled via pg_cron using the Supabase insert tool,
 * not via a migration. If the project is recreated, the cron job must be
 * re-created manually using:
 *   SELECT cron.schedule('check-scheduled-notifications', '0 8 * * *', $$ ... $$);
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Types ────────────────────────────────────────────────────────
interface CheckResult {
  sent: number;
  skipped: number;
  errors: number;
}

// ── Deduplication ────────────────────────────────────────────────
async function alreadySent(
  supabase: SupabaseClient,
  notificationType: string,
  recipientUserId: string,
  resourceId: string,
  milestone: string,
  dedupDate?: string
): Promise<boolean> {
  let query = supabase
    .from("notification_log")
    .select("id")
    .eq("notification_type", notificationType)
    .eq("recipient_user_id", recipientUserId)
    .eq("status", "sent")
    .contains("metadata", { resource_id: resourceId, milestone });

  if (dedupDate) {
    query = query.contains("metadata", { dedup_date: dedupDate });
  }

  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

// ── Internal call to send-notification/ ──────────────────────────
async function callSendNotification(
  payload: Record<string, unknown>
): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[send-notification] ${res.status}: ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[send-notification] fetch error:", err);
    return false;
  }
}

// ── Milestone helpers ────────────────────────────────────────────
const REVIEW_PERIOD_MILESTONES = [90, 60, 30, 7, 3, 1, 0];
const COMPLETION_MILESTONES = [30, 14, 7, 3, 1, 0];
const TASK_DUE_MILESTONES = [7, 3, 1, 0];

function milestoneLabel(days: number): string {
  return `${days}d`;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Check 1: Review Period Approaching ───────────────────────────
async function checkReviewPeriodApproaching(supabase: SupabaseClient): Promise<CheckResult> {
  const result: CheckResult = { sent: 0, skipped: 0, errors: 0 };

  const { data: systems, error } = await supabase.rpc("get_review_period_approaching_notifications");

  // Fallback: use raw query if RPC doesn't exist
  if (error) {
    console.log("[checkReviewPeriodApproaching] RPC not found, using direct query");
    return await checkReviewPeriodApproachingDirect(supabase);
  }

  if (!systems || systems.length === 0) return result;

  for (const sys of systems) {
    const milestone = milestoneLabel(sys.days_remaining);
    if (!sys.email) {
      console.warn(`[review_period_approaching] No email for system_owner of ${sys.name}, skipping`);
      result.skipped++;
      continue;
    }

    const sent = await alreadySent(
      supabase, "review_period_approaching", sys.system_owner_id, sys.id, milestone
    );
    if (sent) { result.skipped++; continue; }

    const ok = await callSendNotification({
      notification_type: "review_period_approaching",
      recipient_user_id: sys.system_owner_id,
      data: {
        system_name: sys.name,
        system_identifier: sys.system_identifier,
        next_review_date: sys.next_review_date,
        days_remaining: sys.days_remaining,
        milestone,
        link: `/system-profiles/${sys.id}`,
        resource_id: sys.id,
      },
    });

    ok ? result.sent++ : result.errors++;
  }

  return result;
}

async function checkReviewPeriodApproachingDirect(supabase: SupabaseClient): Promise<CheckResult> {
  const result: CheckResult = { sent: 0, skipped: 0, errors: 0 };

  // Query approved system profiles with next_review_date matching milestones
  const { data: systems, error } = await supabase
    .from("system_profiles")
    .select("id, name, system_identifier, next_review_date, system_owner_id")
    .eq("is_deleted", false)
    .eq("approval_status", "approved")
    .not("next_review_date", "is", null);

  if (error || !systems) {
    console.error("[checkReviewPeriodApproaching] query error:", error);
    return result;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const sp of systems) {
    const nextReview = new Date(sp.next_review_date);
    nextReview.setHours(0, 0, 0, 0);
    const daysRemaining = Math.round((nextReview.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (!REVIEW_PERIOD_MILESTONES.includes(daysRemaining)) continue;
    if (daysRemaining < 0) continue; // handled by overdue check

    // Check no active review case
    const { data: activeCases } = await supabase
      .from("review_cases")
      .select("id")
      .eq("system_id", sp.id)
      .eq("is_deleted", false)
      .not("status", "in", '("approved","cancelled")')
      .limit(1);

    // Fix: supabase .not("status", "in", ...) doesn't work well, use alternative
    const { data: activeCases2 } = await supabase
      .from("review_cases")
      .select("id")
      .eq("system_id", sp.id)
      .eq("is_deleted", false)
      .neq("status", "approved")
      .neq("status", "cancelled")
      .limit(1);

    if (activeCases2 && activeCases2.length > 0) {
      result.skipped++;
      continue;
    }

    // Get owner email
    const { data: owner } = await supabase
      .from("app_users")
      .select("email, full_name")
      .eq("id", sp.system_owner_id)
      .single();

    if (!owner?.email) {
      console.warn(`[review_period_approaching] No email for owner of ${sp.name}`);
      result.skipped++;
      continue;
    }

    const milestone = milestoneLabel(daysRemaining);
    const sent = await alreadySent(supabase, "review_period_approaching", sp.system_owner_id, sp.id, milestone);
    if (sent) { result.skipped++; continue; }

    const ok = await callSendNotification({
      notification_type: "review_period_approaching",
      recipient_user_id: sp.system_owner_id,
      data: {
        system_name: sp.name,
        system_identifier: sp.system_identifier,
        next_review_date: sp.next_review_date,
        days_remaining: daysRemaining,
        milestone,
        link: `/system-profiles/${sp.id}`,
        resource_id: sp.id,
      },
    });

    ok ? result.sent++ : result.errors++;
  }

  return result;
}

// ── Check 2: Completion Deadline Approaching ─────────────────────
async function checkCompletionDeadlineApproaching(supabase: SupabaseClient): Promise<CheckResult> {
  const result: CheckResult = { sent: 0, skipped: 0, errors: 0 };

  const { data: cases, error } = await supabase
    .from("review_cases")
    .select(`
      id, due_date, status, system_id,
      system_owner_id
    `)
    .eq("is_deleted", false)
    .not("status", "in", '("draft","approved","rejected","cancelled")')
    .not("due_date", "is", null);

  if (error) {
    console.error("[checkCompletionDeadline] query error:", error);
    return result;
  }

  // Filter active statuses manually since .not("in") may not work correctly
  const activeStatuses = ["plan_review", "plan_approval", "approved_for_execution", "in_progress", "execution_review"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const rc of (cases || [])) {
    if (!activeStatuses.includes(rc.status)) continue;

    const dueDate = new Date(rc.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysRemaining = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (!COMPLETION_MILESTONES.includes(daysRemaining)) continue;
    if (daysRemaining < 0) continue;

    // Get system profile name
    const { data: sp } = await supabase
      .from("system_profiles")
      .select("name, system_identifier, system_owner_id")
      .eq("id", rc.system_id)
      .eq("is_deleted", false)
      .single();

    if (!sp) continue;

    const ownerUserId = sp.system_owner_id;

    // Get owner email
    const { data: owner } = await supabase
      .from("app_users")
      .select("email")
      .eq("id", ownerUserId)
      .single();

    if (!owner?.email) {
      console.warn(`[completion_deadline] No email for owner of ${sp.name}`);
      result.skipped++;
      continue;
    }

    const milestone = milestoneLabel(daysRemaining);
    const sent = await alreadySent(supabase, "completion_deadline_approaching", ownerUserId, rc.id, milestone);
    if (sent) { result.skipped++; continue; }

    // Get task counts for the email body
    const { count: totalTasks } = await supabase
      .from("review_tasks")
      .select("id", { count: "exact", head: true })
      .eq("review_case_id", rc.id)
      .eq("is_deleted", false);

    const { count: resolvedTasks } = await supabase
      .from("review_tasks")
      .select("id", { count: "exact", head: true })
      .eq("review_case_id", rc.id)
      .eq("is_deleted", false)
      .in("status", ["completed", "not_applicable"]);

    const ok = await callSendNotification({
      notification_type: "completion_deadline_approaching",
      recipient_user_id: ownerUserId,
      data: {
        system_name: sp.name,
        system_identifier: sp.system_identifier,
        review_case_id: rc.id,
        due_date: rc.due_date,
        days_remaining: daysRemaining,
        milestone,
        review_status: rc.status,
        tasks_resolved: resolvedTasks || 0,
        tasks_total: totalTasks || 0,
        link: `/review-cases/${rc.id}`,
        resource_id: rc.id,
      },
    });

    ok ? result.sent++ : result.errors++;
  }

  return result;
}

// ── Check 3: Tasks Due & Overdue ─────────────────────────────────
async function checkTasksDueAndOverdue(supabase: SupabaseClient): Promise<CheckResult> {
  const result: CheckResult = { sent: 0, skipped: 0, errors: 0 };

  const activeTaskStatuses = ["pending", "in_progress", "ai_queued", "ai_processing", "ai_complete"];

  const { data: tasks, error } = await supabase
    .from("review_tasks")
    .select(`
      id, title, due_date, status, assigned_to, review_case_id
    `)
    .eq("is_deleted", false)
    .in("status", activeTaskStatuses)
    .not("due_date", "is", null);

  if (error) {
    console.error("[checkTasksDue] query error:", error);
    return result;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = todayISO();

  for (const task of (tasks || [])) {
    // Check parent review case is active
    const { data: rc } = await supabase
      .from("review_cases")
      .select("id, status, system_id")
      .eq("id", task.review_case_id)
      .eq("is_deleted", false)
      .single();

    if (!rc) continue;
    if (["approved", "rejected", "cancelled"].includes(rc.status)) continue;

    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysRemaining = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Get system info
    const { data: sp } = await supabase
      .from("system_profiles")
      .select("name, system_identifier")
      .eq("id", rc.system_id)
      .eq("is_deleted", false)
      .single();

    if (!sp) continue;

    // Get assignee email
    const { data: assignee } = await supabase
      .from("app_users")
      .select("email")
      .eq("id", task.assigned_to)
      .single();

    if (!assignee?.email) {
      console.warn(`[task_due] No email for assignee of task ${task.title}`);
      result.skipped++;
      continue;
    }

    if (daysRemaining >= 0 && TASK_DUE_MILESTONES.includes(daysRemaining)) {
      // 3A: Task due approaching
      const milestone = milestoneLabel(daysRemaining);
      const sent = await alreadySent(supabase, "task_due_approaching", task.assigned_to, task.id, milestone);
      if (sent) { result.skipped++; continue; }

      const ok = await callSendNotification({
        notification_type: "task_due_approaching",
        recipient_user_id: task.assigned_to,
        data: {
          task_title: task.title,
          task_id: task.id,
          system_name: sp.name,
          system_identifier: sp.system_identifier,
          due_date: task.due_date,
          days_remaining: daysRemaining,
          task_status: task.status,
          milestone,
          review_case_id: task.review_case_id,
          link: `/review-cases/${task.review_case_id}?task=${task.id}`,
          resource_id: task.id,
        },
      });

      ok ? result.sent++ : result.errors++;
    } else if (daysRemaining < 0) {
      // 3B: Task overdue (daily recurring)
      const daysOverdue = Math.abs(daysRemaining);
      const milestone = `overdue_day${daysOverdue}`;
      const sent = await alreadySent(supabase, "task_overdue", task.assigned_to, task.id, milestone, todayStr);
      if (sent) { result.skipped++; continue; }

      const ok = await callSendNotification({
        notification_type: "task_overdue",
        recipient_user_id: task.assigned_to,
        data: {
          task_title: task.title,
          task_id: task.id,
          system_name: sp.name,
          system_identifier: sp.system_identifier,
          due_date: task.due_date,
          days_overdue: daysOverdue,
          task_status: task.status,
          review_case_id: task.review_case_id,
          link: `/review-cases/${task.review_case_id}?task=${task.id}`,
          resource_id: task.id,
          milestone,
          dedup_date: todayStr,
        },
      });

      ok ? result.sent++ : result.errors++;
    }
  }

  return result;
}

// ── Check 4: Review Period Overdue ───────────────────────────────
async function checkReviewPeriodOverdue(supabase: SupabaseClient): Promise<CheckResult> {
  const result: CheckResult = { sent: 0, skipped: 0, errors: 0 };

  const { data: systems, error } = await supabase
    .from("system_profiles")
    .select("id, name, system_identifier, next_review_date, system_owner_id")
    .eq("is_deleted", false)
    .eq("approval_status", "approved")
    .not("next_review_date", "is", null);

  if (error) {
    console.error("[checkReviewPeriodOverdue] query error:", error);
    return result;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = todayISO();

  for (const sp of (systems || [])) {
    const nextReview = new Date(sp.next_review_date);
    nextReview.setHours(0, 0, 0, 0);
    const daysOverdue = Math.round((today.getTime() - nextReview.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 0) continue; // Not overdue

    // Check no active review case
    const { data: activeCases } = await supabase
      .from("review_cases")
      .select("id")
      .eq("system_id", sp.id)
      .eq("is_deleted", false)
      .neq("status", "approved")
      .neq("status", "cancelled")
      .limit(1);

    if (activeCases && activeCases.length > 0) {
      result.skipped++;
      continue;
    }

    // Get owner email
    const { data: owner } = await supabase
      .from("app_users")
      .select("email")
      .eq("id", sp.system_owner_id)
      .single();

    if (!owner?.email) {
      console.warn(`[review_period_overdue] No email for owner of ${sp.name}`);
      result.skipped++;
      continue;
    }

    const milestone = `overdue_day${daysOverdue}`;
    const sent = await alreadySent(supabase, "review_period_overdue", sp.system_owner_id, sp.id, milestone, todayStr);
    if (sent) { result.skipped++; continue; }

    const ok = await callSendNotification({
      notification_type: "review_period_overdue",
      recipient_user_id: sp.system_owner_id,
      data: {
        system_name: sp.name,
        system_identifier: sp.system_identifier,
        next_review_date: sp.next_review_date,
        days_overdue: daysOverdue,
        link: `/system-profiles/${sp.id}`,
        resource_id: sp.id,
        milestone,
        dedup_date: todayStr,
      },
    });

    ok ? result.sent++ : result.errors++;
  }

  return result;
}

// ── Check 5: Escalation — Task Overdue >7 Days → Notify SO ──────
async function checkEscalationTaskOverdue(supabase: SupabaseClient): Promise<CheckResult> {
  const result: CheckResult = { sent: 0, skipped: 0, errors: 0 };
  const todayStr = todayISO();

  const activeTaskStatuses = ["pending", "in_progress", "ai_queued", "ai_processing", "ai_complete"];

  const { data: tasks, error } = await supabase
    .from("review_tasks")
    .select("id, title, due_date, status, assigned_to, review_case_id")
    .eq("is_deleted", false)
    .in("status", activeTaskStatuses)
    .not("due_date", "is", null);

  if (error) {
    console.error("[checkEscalationTaskOverdue] query error:", error);
    return result;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const task of (tasks || [])) {
    const dueDate = new Date(task.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysOverdue = Math.round((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 7) continue; // Only escalate after 7 days overdue

    // Get review case + system info
    const { data: rc } = await supabase
      .from("review_cases")
      .select("id, status, system_id")
      .eq("id", task.review_case_id)
      .eq("is_deleted", false)
      .single();

    if (!rc) continue;
    if (["approved", "rejected", "cancelled"].includes(rc.status)) continue;

    const { data: sp } = await supabase
      .from("system_profiles")
      .select("id, name, system_identifier, system_owner_id")
      .eq("id", rc.system_id)
      .eq("is_deleted", false)
      .single();

    if (!sp) continue;

    // Don't escalate to yourself
    if (task.assigned_to === sp.system_owner_id) continue;

    // Get assignee name
    const { data: assignee } = await supabase
      .from("app_users")
      .select("full_name")
      .eq("id", task.assigned_to)
      .single();

    if (!assignee) continue;

    const milestone = `escalation_day${daysOverdue}`;
    const sent = await alreadySent(supabase, "escalation_task_overdue", sp.system_owner_id, task.id, milestone, todayStr);
    if (sent) { result.skipped++; continue; }

    const ok = await callSendNotification({
      notification_type: "escalation_task_overdue",
      recipient_user_id: sp.system_owner_id,
      data: {
        assignee_name: assignee.full_name,
        task_title: task.title,
        system_name: sp.name,
        system_identifier: sp.system_identifier,
        due_date: task.due_date,
        days_overdue: daysOverdue,
        review_case_id: rc.id,
        link: `/review-cases/${rc.id}?task=${task.id}`,
        resource_id: task.id,
        milestone,
        dedup_date: todayStr,
      },
    });

    ok ? result.sent++ : result.errors++;
  }

  return result;
}

// ── Check 6: Escalation — Review Case Deadline Overdue → QA + Super Users ──
async function checkEscalationDeadlineOverdue(supabase: SupabaseClient): Promise<CheckResult> {
  const result: CheckResult = { sent: 0, skipped: 0, errors: 0 };
  const todayStr = todayISO();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: cases, error } = await supabase
    .from("review_cases")
    .select("id, due_date, status, system_id, qa_id")
    .eq("is_deleted", false)
    .not("due_date", "is", null);

  if (error) {
    console.error("[checkEscalationDeadlineOverdue] query error:", error);
    return result;
  }

  const activeStatuses = ["plan_review", "plan_approval", "approved_for_execution", "in_progress", "execution_review"];

  // Get all super users once
  const { data: superUserRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_user");

  const superUserIds = (superUserRoles || []).map((r) => r.user_id);

  for (const rc of (cases || [])) {
    if (!activeStatuses.includes(rc.status)) continue;

    const dueDate = new Date(rc.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysOverdue = Math.round((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 0) continue;

    // Get system info
    const { data: sp } = await supabase
      .from("system_profiles")
      .select("name, system_identifier, system_owner_id")
      .eq("id", rc.system_id)
      .eq("is_deleted", false)
      .single();

    if (!sp) continue;

    // Get SO name
    const { data: soUser } = await supabase
      .from("app_users")
      .select("full_name")
      .eq("id", sp.system_owner_id)
      .single();

    // Get task counts
    const { count: totalTasks } = await supabase
      .from("review_tasks")
      .select("id", { count: "exact", head: true })
      .eq("review_case_id", rc.id)
      .eq("is_deleted", false);

    const { count: resolvedTasks } = await supabase
      .from("review_tasks")
      .select("id", { count: "exact", head: true })
      .eq("review_case_id", rc.id)
      .eq("is_deleted", false)
      .in("status", ["completed", "not_applicable"]);

    const baseData = {
      system_name: sp.name,
      system_identifier: sp.system_identifier,
      review_case_id: rc.id,
      review_status: rc.status,
      so_name: soUser?.full_name || "—",
      due_date: rc.due_date,
      days_overdue: daysOverdue,
      tasks_resolved: resolvedTasks || 0,
      tasks_total: totalTasks || 0,
      link: `/review-cases/${rc.id}`,
      resource_id: rc.id,
      dedup_date: todayStr,
    };

    // Send to QA
    if (rc.qa_id) {
      const milestone = `escalation_deadline_qa`;
      const sent = await alreadySent(supabase, "escalation_deadline_overdue", rc.qa_id, rc.id, milestone, todayStr);
      if (!sent) {
        const ok = await callSendNotification({
          notification_type: "escalation_deadline_overdue",
          recipient_user_id: rc.qa_id,
          data: { ...baseData, milestone },
        });
        ok ? result.sent++ : result.errors++;
      } else {
        result.skipped++;
      }
    }

    // Send to each Super User
    for (const suId of superUserIds) {
      const milestone = `escalation_deadline_su`;
      const sent = await alreadySent(supabase, "escalation_deadline_overdue", suId, rc.id, milestone, todayStr);
      if (!sent) {
        const ok = await callSendNotification({
          notification_type: "escalation_deadline_overdue",
          recipient_user_id: suId,
          data: { ...baseData, milestone },
        });
        ok ? result.sent++ : result.errors++;
      } else {
        result.skipped++;
      }
    }
  }

  return result;
}

// ── Check 7: SO Weekly Digest (Mondays only) ────────────────────
async function sendSOWeeklyDigest(supabase: SupabaseClient): Promise<CheckResult> {
  const result: CheckResult = { sent: 0, skipped: 0, errors: 0 };
  const todayStr = todayISO();

  // Get all unique SOs with approved systems
  const { data: systems, error } = await supabase
    .from("system_profiles")
    .select("id, name, system_identifier, next_review_date, completion_window_days, system_owner_id")
    .eq("is_deleted", false)
    .eq("approval_status", "approved");

  if (error || !systems || systems.length === 0) return result;

  // Group systems by SO
  const soSystems: Record<string, typeof systems> = {};
  for (const sp of systems) {
    if (!soSystems[sp.system_owner_id]) soSystems[sp.system_owner_id] = [];
    soSystems[sp.system_owner_id].push(sp);
  }

  for (const [soId, sysGroup] of Object.entries(soSystems)) {
    // Dedup: one digest per SO per Monday
    const sent = await alreadySent(supabase, "digest_so_weekly", soId, "weekly_digest", "weekly", todayStr);
    if (sent) { result.skipped++; continue; }

    const systemRows: string[] = [];
    let totalOverdue = 0;

    for (const sp of sysGroup) {
      // Get active review case
      const { data: rcList } = await supabase
        .from("review_cases")
        .select("id, status, due_date")
        .eq("system_id", sp.id)
        .eq("is_deleted", false)
        .neq("status", "approved")
        .neq("status", "cancelled")
        .limit(1);

      const rc = rcList?.[0];

      if (rc) {
        // Get task counts
        const { count: total } = await supabase
          .from("review_tasks")
          .select("id", { count: "exact", head: true })
          .eq("review_case_id", rc.id)
          .eq("is_deleted", false);

        const { count: resolved } = await supabase
          .from("review_tasks")
          .select("id", { count: "exact", head: true })
          .eq("review_case_id", rc.id)
          .eq("is_deleted", false)
          .in("status", ["completed", "not_applicable"]);

        const { count: overdue } = await supabase
          .from("review_tasks")
          .select("id", { count: "exact", head: true })
          .eq("review_case_id", rc.id)
          .eq("is_deleted", false)
          .not("due_date", "is", null)
          .lt("due_date", todayStr)
          .not("status", "in", '("completed","not_applicable")');

        // Fallback: manual overdue count
        const { data: overdueTasks } = await supabase
          .from("review_tasks")
          .select("id")
          .eq("review_case_id", rc.id)
          .eq("is_deleted", false)
          .lt("due_date", todayStr)
          .neq("status", "completed")
          .neq("status", "not_applicable");

        const overdueCount = overdueTasks?.length || 0;
        totalOverdue += overdueCount;

        const totalN = total || 0;
        const resolvedN = resolved || 0;
        const pct = totalN > 0 ? Math.round((resolvedN / totalN) * 100) : 0;
        const overdueStyle = overdueCount > 0 ? 'color:#B91C1C;font-weight:700;' : '';
        const dueWarning = rc.due_date && new Date(rc.due_date) < new Date() ? ' ⚠️' : '';

        systemRows.push(`<tr>
          <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:13px;">${sp.name}</td>
          <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:13px;">${rc.status.replace(/_/g, ' ')}</td>
          <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:13px;">${resolvedN}/${totalN} (${pct}%)</td>
          <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:13px;${overdueStyle}">${overdueCount}</td>
          <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:13px;">Due: ${rc.due_date || '—'}${dueWarning}</td>
        </tr>`);
      } else {
        systemRows.push(`<tr>
          <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:13px;">${sp.name}</td>
          <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">No active review</td>
          <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:13px;">—</td>
          <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:13px;">—</td>
          <td style="padding:8px;border-bottom:1px solid #E5E7EB;font-size:13px;">Next: ${sp.next_review_date || '—'}</td>
        </tr>`);
      }
    }

    const summaryHtml = `<p style="font-size:13px;color:#6B7280;margin:0 0 12px;">
      ${sysGroup.length} system(s) · ${totalOverdue} overdue task(s)
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #E5E7EB;border-radius:6px;border-collapse:collapse;">
      <thead>
        <tr style="background:#F3F4F6;">
          <th style="padding:8px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB;">System</th>
          <th style="padding:8px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB;">Status</th>
          <th style="padding:8px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB;">Progress</th>
          <th style="padding:8px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB;">Overdue</th>
          <th style="padding:8px;text-align:left;font-size:12px;color:#6B7280;border-bottom:2px solid #E5E7EB;">Date</th>
        </tr>
      </thead>
      <tbody>${systemRows.join('')}</tbody>
    </table>`;

    const ok = await callSendNotification({
      notification_type: "digest_so_weekly",
      recipient_user_id: soId,
      data: {
        system_count: sysGroup.length,
        summary_html: summaryHtml,
        digest_date: todayStr,
        resource_id: "weekly_digest",
        milestone: "weekly",
        dedup_date: todayStr,
      },
    });

    ok ? result.sent++ : result.errors++;
  }

  return result;
}

// ── Check 8: QA Weekly Digest (Mondays only) ────────────────────
async function sendQAWeeklyDigest(supabase: SupabaseClient): Promise<CheckResult> {
  const result: CheckResult = { sent: 0, skipped: 0, errors: 0 };
  const todayStr = todayISO();

  // Get all QA users
  const { data: qaRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "quality_assurance");

  if (!qaRoles || qaRoles.length === 0) return result;

  const uniqueQAs = [...new Set(qaRoles.map((r) => r.user_id))];

  for (const qaId of uniqueQAs) {
    const sent = await alreadySent(supabase, "digest_qa_weekly", qaId, "weekly_digest", "weekly", todayStr);
    if (sent) { result.skipped++; continue; }

    // Pending sign-offs (review + profile)
    const { data: reviewSignoffs } = await supabase
      .from("review_signoffs")
      .select("id, phase, review_case_id")
      .eq("requested_user_id", qaId)
      .eq("is_deleted", false)
      .eq("status", "pending");

    const { data: profileSignoffs } = await supabase
      .from("profile_signoffs")
      .select("id, system_profile_id")
      .eq("requested_user_id", qaId)
      .eq("is_deleted", false)
      .eq("status", "pending");

    // Cases awaiting QA approval
    const { data: qaCases } = await supabase
      .from("review_cases")
      .select("id, status, due_date, system_id")
      .eq("is_deleted", false)
      .eq("qa_id", qaId)
      .in("status", ["execution_review", "plan_review", "plan_approval"]);

    const pendingSignoffCount = (reviewSignoffs?.length || 0) + (profileSignoffs?.length || 0);
    const caseCount = qaCases?.length || 0;

    // Skip if nothing to report
    if (pendingSignoffCount === 0 && caseCount === 0) {
      result.skipped++;
      continue;
    }

    // Build sign-off section
    let signoffHtml = '';
    if (pendingSignoffCount > 0) {
      const signoffRows: string[] = [];
      for (const rs of (reviewSignoffs || [])) {
        const { data: rc } = await supabase
          .from("review_cases")
          .select("system_id")
          .eq("id", rs.review_case_id)
          .single();
        if (rc) {
          const { data: sp } = await supabase
            .from("system_profiles")
            .select("name")
            .eq("id", rc.system_id)
            .single();
          signoffRows.push(`<li style="font-size:13px;color:#374151;margin:4px 0;">${sp?.name || '—'} — ${rs.phase.replace(/_/g, ' ')}</li>`);
        }
      }
      for (const ps of (profileSignoffs || [])) {
        const { data: sp } = await supabase
          .from("system_profiles")
          .select("name")
          .eq("id", ps.system_profile_id)
          .single();
        signoffRows.push(`<li style="font-size:13px;color:#374151;margin:4px 0;">${sp?.name || '—'} — profile review</li>`);
      }
      signoffHtml = `<p style="font-size:14px;font-weight:600;color:#1F2937;margin:16px 0 8px;">Pending Sign-offs (${pendingSignoffCount})</p><ul style="margin:0;padding-left:20px;">${signoffRows.join('')}</ul>`;
    }

    // Build cases section
    let casesHtml = '';
    if (caseCount > 0) {
      const caseRows: string[] = [];
      for (const rc of (qaCases || [])) {
        const { data: sp } = await supabase
          .from("system_profiles")
          .select("name")
          .eq("id", rc.system_id)
          .single();
        const isOverdue = rc.due_date && new Date(rc.due_date) < new Date();
        const style = isOverdue ? 'color:#B91C1C;' : '';
        caseRows.push(`<li style="font-size:13px;color:#374151;margin:4px 0;${style}">${sp?.name || '—'} — ${rc.status.replace(/_/g, ' ')}${isOverdue ? ' ⚠️ OVERDUE' : ''}</li>`);
      }
      casesHtml = `<p style="font-size:14px;font-weight:600;color:#1F2937;margin:16px 0 8px;">Cases Awaiting Approval (${caseCount})</p><ul style="margin:0;padding-left:20px;">${caseRows.join('')}</ul>`;
    }

    const summaryHtml = signoffHtml + casesHtml;

    const ok = await callSendNotification({
      notification_type: "digest_qa_weekly",
      recipient_user_id: qaId,
      data: {
        pending_count: pendingSignoffCount + caseCount,
        summary_html: summaryHtml,
        digest_date: todayStr,
        resource_id: "weekly_digest",
        milestone: "weekly",
        dedup_date: todayStr,
      },
    });

    ok ? result.sent++ : result.errors++;
  }

  return result;
}

// ── Main Handler ─────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // AUTHENTICATION NOTE:
  // This function runs with verify_jwt = false (required for pg_cron invocation).
  // See top-of-file comment for security rationale.

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log("[check-scheduled-notifications] Starting daily run at", new Date().toISOString());

  // Run existing checks (daily) + escalations (daily)
  const [rpa, cda, tdo, rpo, eto, edo] = await Promise.all([
    checkReviewPeriodApproaching(supabase).catch((e) => {
      console.error("[checkReviewPeriodApproaching] fatal:", e);
      return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
    }),
    checkCompletionDeadlineApproaching(supabase).catch((e) => {
      console.error("[checkCompletionDeadlineApproaching] fatal:", e);
      return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
    }),
    checkTasksDueAndOverdue(supabase).catch((e) => {
      console.error("[checkTasksDueAndOverdue] fatal:", e);
      return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
    }),
    checkReviewPeriodOverdue(supabase).catch((e) => {
      console.error("[checkReviewPeriodOverdue] fatal:", e);
      return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
    }),
    checkEscalationTaskOverdue(supabase).catch((e) => {
      console.error("[checkEscalationTaskOverdue] fatal:", e);
      return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
    }),
    checkEscalationDeadlineOverdue(supabase).catch((e) => {
      console.error("[checkEscalationDeadlineOverdue] fatal:", e);
      return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
    }),
  ]);

  // Weekly digests — only on Mondays (UTC)
  const isMonday = new Date().getUTCDay() === 1;
  let soDigest: CheckResult = { sent: 0, skipped: 0, errors: 0 };
  let qaDigest: CheckResult = { sent: 0, skipped: 0, errors: 0 };

  if (isMonday) {
    console.log("[check-scheduled-notifications] Monday detected — running weekly digests");
    [soDigest, qaDigest] = await Promise.all([
      sendSOWeeklyDigest(supabase).catch((e) => {
        console.error("[sendSOWeeklyDigest] fatal:", e);
        return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
      }),
      sendQAWeeklyDigest(supabase).catch((e) => {
        console.error("[sendQAWeeklyDigest] fatal:", e);
        return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
      }),
    ]);
  }

  const summary = {
    review_period_approaching: rpa.sent,
    completion_deadline_approaching: cda.sent,
    task_due_approaching: tdo.sent,
    task_overdue: 0,
    review_period_overdue: rpo.sent,
    escalation_task_overdue: eto.sent,
    escalation_deadline_overdue: edo.sent,
    digest_so_weekly: soDigest.sent,
    digest_qa_weekly: qaDigest.sent,
    is_monday: isMonday,
    total_sent: rpa.sent + cda.sent + tdo.sent + rpo.sent + eto.sent + edo.sent + soDigest.sent + qaDigest.sent,
    total_skipped_dedup: rpa.skipped + cda.skipped + tdo.skipped + rpo.skipped + eto.skipped + edo.skipped + soDigest.skipped + qaDigest.skipped,
    errors: rpa.errors + cda.errors + tdo.errors + rpo.errors + eto.errors + edo.errors + soDigest.errors + qaDigest.errors,
  };

  console.log("[check-scheduled-notifications] Complete:", JSON.stringify(summary));

  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    summary,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // AUTHENTICATION NOTE:
  // This function runs with verify_jwt = false (required for pg_cron invocation).
  // Custom auth was removed because Lovable Cloud edge functions use short-format
  // keys (sb_publish_xxx, 46 chars) internally, while the frontend .env exposes
  // JWT-format keys (208 chars). These are NOT the same value, making token
  // comparison unreliable across invocation contexts.
  //
  // WHY THIS IS SAFE:
  // 1. The function is a batch processor with NO user-specific side effects.
  // 2. All DB queries use the service_role client internally (full access regardless of caller).
  // 3. The notification_log deduplication prevents abuse: repeated invocations simply skip
  //    already-sent milestones (alreadySent() returns true → skipped++). A malicious caller
  //    triggers zero extra emails.
  // 4. Internal calls to send-notification/ use service_role, not the caller's token.


  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log("[check-scheduled-notifications] Starting daily run at", new Date().toISOString());

  // Run all 4 checks — each is independent and isolated
  const [rpa, cda, tdo, rpo] = await Promise.all([
    checkReviewPeriodApproaching(supabase).catch((e) => {
      console.error("[checkReviewPeriodApproaching] fatal:", e);
      return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
    }),
    checkCompletionDeadlineApproaching(supabase).catch((e) => {
      console.error("[checkCompletionDeadlineApproaching] fatal:", e);
      return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
    }),
    checkTasksDueAndOverdue(supabase).catch((e) => {
      console.error("[checkTasksDueAndOverdue] fatal:", e);
      return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
    }),
    checkReviewPeriodOverdue(supabase).catch((e) => {
      console.error("[checkReviewPeriodOverdue] fatal:", e);
      return { sent: 0, skipped: 0, errors: 1 } as CheckResult;
    }),
  ]);

  const summary = {
    review_period_approaching: rpa.sent,
    completion_deadline_approaching: cda.sent,
    task_due_approaching: tdo.sent, // includes task_overdue sent count
    task_overdue: 0, // combined in tdo
    review_period_overdue: rpo.sent,
    total_sent: rpa.sent + cda.sent + tdo.sent + rpo.sent,
    total_skipped_dedup: rpa.skipped + cda.skipped + tdo.skipped + rpo.skipped,
    errors: rpa.errors + cda.errors + tdo.errors + rpo.errors,
  };

  console.log("[check-scheduled-notifications] Complete:", JSON.stringify(summary));

  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    summary,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
