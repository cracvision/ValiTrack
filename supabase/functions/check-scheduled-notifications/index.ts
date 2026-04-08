import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * check-scheduled-notifications — Phase 3 Time-Driven Notifications
 *
 * Invoked daily at 08:00 UTC via pg_cron + pg_net.
 * Queries DB for time-based conditions and delegates email sending
 * to the existing send-notification/ Edge Function.
 *
 * Authentication: Validates Authorization header against SUPABASE_SERVICE_ROLE_KEY.
 * This function is NOT meant to be called by end users.
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

// ── Main Handler ─────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authenticate: only service_role key is allowed
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized: missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Forbidden: only service_role key is accepted" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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
