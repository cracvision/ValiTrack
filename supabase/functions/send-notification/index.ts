import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL")!;
const VALITRACK_APP_URL = Deno.env.get("VALITRACK_APP_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const resend = new Resend(RESEND_API_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Notification Type Constants ──────────────────────────────────
const NOTIFICATION_TYPES = {
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
  PASSWORD_RESET: "password_reset",
} as const;

// ── Base Email Layout ────────────────────────────────────────────
function wrapInBaseLayout(params: {
  recipientName: string;
  body: string;
  ctaText: string | null;
  ctaUrl: string | null;
  lang: "en" | "es";
}): string {
  const { recipientName, body, ctaText, ctaUrl, lang } = params;
  const greeting = lang === "es" ? `Hola ${recipientName},` : `Hello ${recipientName},`;
  const footer = lang === "es"
    ? "Este es un mensaje automático de ValiTrack. No responda a este correo."
    : "This is an automated message from ValiTrack. Do not reply to this email.";

  const ctaButton = ctaText && ctaUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px auto;">
        <tr>
          <td style="background:#2563A0;border-radius:6px;padding:12px 28px;">
            <a href="${ctaUrl}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">${ctaText}</a>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#F9FAFB;">
    <tr>
      <td style="padding:32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin:0 auto;max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 32px;background:#2563A0;border-radius:8px 8px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ValiTrack</td>
                  <td style="color:#93C5FD;font-size:12px;padding-left:12px;vertical-align:bottom;">Periodic Review Manager</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;background:#FFFFFF;border-left:1px solid #E5E7EB;border-right:1px solid #E5E7EB;">
              <p style="margin:0 0 16px;font-size:15px;color:#1F2937;">${greeting}</p>
              ${body}
              ${ctaButton}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#F3F4F6;border-radius:0 0 8px 8px;border:1px solid #E5E7EB;border-top:none;">
              <p style="margin:0;font-size:12px;color:#6B7280;text-align:center;">${footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Detail Table Helper ──────────────────────────────────────────
function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;color:#6B7280;border-bottom:1px solid #F3F4F6;width:40%;">${label}</td>
    <td style="padding:8px 12px;font-size:13px;color:#1F2937;border-bottom:1px solid #F3F4F6;font-weight:500;">${value}</td>
  </tr>`;
}

function detailTable(rows: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid #E5E7EB;border-radius:6px;margin:16px 0;border-collapse:collapse;">${rows}</table>`;
}

// ── Urgency Badge Helper (Phase 3 color-coding) ──────────────────
function urgencyBadge(daysRemaining: number, lang: "en" | "es", isOverdue: boolean): string {
  let color: string;
  let bgColor: string;
  let label: string;

  if (isOverdue || daysRemaining < 0) {
    color = "#B91C1C"; bgColor = "#FEF2F2";
    label = lang === "es" ? "⚠️ VENCIDO" : "⚠️ OVERDUE";
  } else if (daysRemaining <= 3) {
    color = "#B91C1C"; bgColor = "#FEF2F2";
    label = lang === "es" ? "🔴 URGENTE" : "🔴 URGENT";
  } else if (daysRemaining <= 7) {
    color = "#C2410C"; bgColor = "#FFF7ED";
    label = lang === "es" ? "🟠 PRONTO" : "🟠 DUE SOON";
  } else if (daysRemaining <= 30) {
    color = "#B45309"; bgColor = "#FFFBEB";
    label = lang === "es" ? "🟡 PRÓXIMO" : "🟡 UPCOMING";
  } else {
    color = "#15803D"; bgColor = "#F0FDF4";
    label = lang === "es" ? "🟢 PROGRAMADO" : "🟢 SCHEDULED";
  }

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;">
    <tr>
      <td style="background:${bgColor};border:1px solid ${color}22;border-radius:4px;padding:6px 14px;">
        <span style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
      </td>
    </tr>
  </table>`;
}

const ROLE_LABELS: Record<string, string> = {
  super_user: "Super User",
  system_owner: "System Owner",
  system_administrator: "System Administrator",
  business_owner: "Business Owner",
  quality_assurance: "Quality Assurance",
  it_manager: "IT Manager",
};


interface EmailTemplate {
  subject: Record<string, (d: any) => string>;
  body: Record<string, (d: any) => string>;
  cta?: Record<string, string>;
  ctaUrl?: (d: any) => string;
}

const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {

  // ── Phase 2: Event-Driven ──────────────────────────────────
  task_assigned: {
    subject: {
      en: (d) => `New Task: ${d.task_title} — ${d.system_name}`,
      es: (d) => `Nueva Tarea: ${d.task_title} — ${d.system_name}`,
    },
    body: {
      en: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">You have been assigned a new task as part of the periodic review for <strong>${d.system_name}</strong>.</p>
        ${detailTable(
          detailRow("Task", d.task_title) +
          detailRow("Group", d.task_group) +
          detailRow("Due Date", d.due_date || "Not set")
        )}`,
      es: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Se le ha asignado una nueva tarea como parte de la revisión periódica de <strong>${d.system_name}</strong>.</p>
        ${detailTable(
          detailRow("Tarea", d.task_title) +
          detailRow("Grupo", d.task_group) +
          detailRow("Fecha límite", d.due_date || "No asignada")
        )}`,
    },
    cta: { en: "View Task", es: "Ver Tarea" },
    ctaUrl: (d) => `${d.app_url}/review-cases/${d.review_case_id}?task=${d.task_id}`,
  },

  task_reassigned: {
    subject: {
      en: (d) => `Task Reassigned: ${d.task_title} — ${d.system_name}`,
      es: (d) => `Tarea Reasignada: ${d.task_title} — ${d.system_name}`,
    },
    body: {
      en: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">A task has been ${d.is_new_assignee ? "reassigned to you" : "reassigned from you to another user"} for the periodic review of <strong>${d.system_name}</strong>.</p>
        ${detailTable(
          detailRow("Task", d.task_title) +
          detailRow("Previous Assignee", d.previous_assignee) +
          detailRow("New Assignee", d.new_assignee) +
          detailRow("Reason", d.reason)
        )}`,
      es: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Una tarea ha sido ${d.is_new_assignee ? "reasignada a usted" : "reasignada de usted a otro usuario"} para la revisión periódica de <strong>${d.system_name}</strong>.</p>
        ${detailTable(
          detailRow("Tarea", d.task_title) +
          detailRow("Asignado anterior", d.previous_assignee) +
          detailRow("Nuevo asignado", d.new_assignee) +
          detailRow("Razón", d.reason)
        )}`,
    },
    cta: { en: "View Task", es: "Ver Tarea" },
    ctaUrl: (d) => `${d.app_url}/review-cases/${d.review_case_id}?task=${d.task_id}`,
  },

  review_initiated: {
    subject: {
      en: (d) => `Periodic Review Initiated: ${d.system_name}`,
      es: (d) => `Revisión Periódica Iniciada: ${d.system_name}`,
    },
    body: {
      en: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">A periodic review has been initiated for <strong>${d.system_name}</strong>. You have been assigned tasks as part of this review.</p>
        ${detailTable(
          detailRow("System", d.system_name) +
          detailRow("Review Period", `${d.period_start} — ${d.period_end}`) +
          detailRow("Your Role", d.recipient_role) +
          detailRow("Tasks Assigned", `${d.task_count} task(s)`) +
          detailRow("Completion Due", d.due_date || "Not set")
        )}
        <p style="margin:16px 0 0;font-size:14px;color:#374151;">Please review your assigned tasks in ValiTrack and begin working on them according to the review plan.</p>`,
      es: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Se ha iniciado una revisión periódica para <strong>${d.system_name}</strong>. Se le han asignado tareas como parte de esta revisión.</p>
        ${detailTable(
          detailRow("Sistema", d.system_name) +
          detailRow("Período de revisión", `${d.period_start} — ${d.period_end}`) +
          detailRow("Su rol", d.recipient_role) +
          detailRow("Tareas asignadas", `${d.task_count} tarea(s)`) +
          detailRow("Fecha límite", d.due_date || "No asignada")
        )}
        <p style="margin:16px 0 0;font-size:14px;color:#374151;">Revise sus tareas asignadas en ValiTrack y comience a trabajar en ellas según el plan de revisión.</p>`,
    },
    cta: { en: "View My Tasks", es: "Ver Mis Tareas" },
    ctaUrl: (d) => `${d.app_url}/intray?tab=tasks`,
  },

  review_status_changed: {
    subject: {
      en: (d) => `Review ${d.new_status}: ${d.system_name}`,
      es: (d) => `Revisión ${d.new_status_es}: ${d.system_name}`,
    },
    body: {
      en: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">The periodic review for <strong>${d.system_name}</strong> has changed status.</p>
        ${detailTable(
          detailRow("Previous Status", d.previous_status) +
          detailRow("New Status", d.new_status) +
          (d.reason ? detailRow("Reason", d.reason) : "")
        )}`,
      es: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">La revisión periódica de <strong>${d.system_name}</strong> ha cambiado de estado.</p>
        ${detailTable(
          detailRow("Estado anterior", d.previous_status_es) +
          detailRow("Nuevo estado", d.new_status_es) +
          (d.reason ? detailRow("Razón", d.reason) : "")
        )}`,
    },
    cta: { en: "View Review Case", es: "Ver Caso de Revisión" },
    ctaUrl: (d) => `${d.app_url}/review-cases/${d.review_case_id}`,
  },

  signoff_requested: {
    subject: {
      en: (d) => `Sign-off Requested: ${d.system_name}`,
      es: (d) => `Firma Requerida: ${d.system_name}`,
    },
    body: {
      en: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Your sign-off is required for the <strong>${d.signoff_phase}</strong> of <strong>${d.system_name}</strong>.</p>
        <p style="margin:0;font-size:14px;color:#374151;">Please review the ${d.resource_type === "system_profile" ? "system profile" : "review case"} and provide your sign-off (no objections or raise objections).</p>`,
      es: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Se requiere su firma para la <strong>${d.signoff_phase_es}</strong> de <strong>${d.system_name}</strong>.</p>
        <p style="margin:0;font-size:14px;color:#374151;">Revise el ${d.resource_type === "system_profile" ? "perfil del sistema" : "caso de revisión"} y provea su firma (sin objeciones o presentar objeciones).</p>`,
    },
    cta: { en: "Review & Sign", es: "Revisar y Firmar" },
    ctaUrl: (d) => d.resource_type === "system_profile"
      ? `${d.app_url}/system-profiles/${d.resource_id}`
      : `${d.app_url}/review-cases/${d.resource_id}`,
  },

  approval_pending: {
    subject: {
      en: (d) => `Approval Required (E-Signature): ${d.system_name}`,
      es: (d) => `Aprobación Requerida (Firma Electrónica): ${d.system_name}`,
    },
    body: {
      en: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">A review case for <strong>${d.system_name}</strong> requires your e-signature for <strong>${d.transition_label}</strong>.</p>
        <p style="margin:0;font-size:14px;color:#374151;">All required sign-offs have been completed. Your e-signature is needed to proceed.</p>`,
      es: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Un caso de revisión de <strong>${d.system_name}</strong> requiere su firma electrónica para <strong>${d.transition_label_es}</strong>.</p>
        <p style="margin:0;font-size:14px;color:#374151;">Todas las firmas requeridas han sido completadas. Se necesita su firma electrónica para proceder.</p>`,
    },
    cta: { en: "Approve with E-Signature", es: "Aprobar con Firma Electrónica" },
    ctaUrl: (d) => `${d.app_url}/review-cases/${d.review_case_id}`,
  },

  // ── Phase 3: Time-Driven (with urgency color-coding) ─────
  task_due_approaching: {
    subject: {
      en: (d) => d.days_remaining === 0
        ? `[ValiTrack] Task due TODAY: ${d.task_title}`
        : d.days_remaining === 1
          ? `[ValiTrack] Task due TOMORROW: ${d.task_title}`
          : `[ValiTrack] Task due in ${d.days_remaining} days: ${d.task_title}`,
      es: (d) => d.days_remaining === 0
        ? `[ValiTrack] Tarea vence HOY: ${d.task_title}`
        : d.days_remaining === 1
          ? `[ValiTrack] Tarea vence MAÑANA: ${d.task_title}`
          : `[ValiTrack] Tarea vence en ${d.days_remaining} días: ${d.task_title}`,
    },
    body: {
      en: (d) => {
        const urgency = urgencyBadge(d.days_remaining, "en", false);
        const timeLabel = d.days_remaining === 0 ? "today" : d.days_remaining === 1 ? "tomorrow" : `in <strong>${d.days_remaining} day(s)</strong>`;
        return `${urgency}
          <p style="margin:0 0 16px;font-size:14px;color:#374151;">Your task <strong>${d.task_title}</strong> for <strong>${d.system_name}</strong> is due ${timeLabel}.</p>
          ${detailTable(
            detailRow("Task", d.task_title) +
            detailRow("System", `${d.system_name} (${d.system_identifier || ""})`) +
            detailRow("Due Date", d.due_date) +
            detailRow("Status", d.task_status || d.status || "—")
          )}
          <p style="margin:16px 0 0;font-size:14px;color:#374151;">Please complete this task before the due date to avoid delays in the review process.</p>`;
      },
      es: (d) => {
        const urgency = urgencyBadge(d.days_remaining, "es", false);
        const timeLabel = d.days_remaining === 0 ? "hoy" : d.days_remaining === 1 ? "mañana" : `en <strong>${d.days_remaining} día(s)</strong>`;
        return `${urgency}
          <p style="margin:0 0 16px;font-size:14px;color:#374151;">Su tarea <strong>${d.task_title}</strong> para <strong>${d.system_name}</strong> vence ${timeLabel}.</p>
          ${detailTable(
            detailRow("Tarea", d.task_title) +
            detailRow("Sistema", `${d.system_name} (${d.system_identifier || ""})`) +
            detailRow("Fecha límite", d.due_date) +
            detailRow("Estado", d.task_status || d.status || "—")
          )}
          <p style="margin:16px 0 0;font-size:14px;color:#374151;">Complete esta tarea antes de la fecha límite para evitar retrasos en el proceso de revisión.</p>`;
      },
    },
    cta: { en: "View Task", es: "Ver Tarea" },
    ctaUrl: (d) => `${d.app_url}/review-cases/${d.review_case_id}?task=${d.task_id}`,
  },

  task_overdue: {
    subject: {
      en: (d) => `[ValiTrack] OVERDUE: ${d.task_title} (${d.days_overdue} days past due)`,
      es: (d) => `[ValiTrack] VENCIDA: ${d.task_title} (${d.days_overdue} días de retraso)`,
    },
    body: {
      en: (d) => `${urgencyBadge(-1, "en", true)}
        <p style="margin:0 0 16px;font-size:14px;color:#B91C1C;font-weight:600;">This task is overdue by ${d.days_overdue} day(s).</p>
        ${detailTable(
          detailRow("Task", d.task_title) +
          detailRow("System", `${d.system_name} (${d.system_identifier || ""})`) +
          detailRow("Original Due Date", d.due_date) +
          detailRow("Days Overdue", `<span style="color:#B91C1C;font-weight:700;">${d.days_overdue}</span>`) +
          detailRow("Status", d.task_status || d.status || "—")
        )}
        <p style="margin:16px 0 0;font-size:14px;color:#374151;">Please complete this task immediately to avoid impacting the review timeline.</p>`,
      es: (d) => `${urgencyBadge(-1, "es", true)}
        <p style="margin:0 0 16px;font-size:14px;color:#B91C1C;font-weight:600;">Esta tarea está vencida por ${d.days_overdue} día(s).</p>
        ${detailTable(
          detailRow("Tarea", d.task_title) +
          detailRow("Sistema", `${d.system_name} (${d.system_identifier || ""})`) +
          detailRow("Fecha límite original", d.due_date) +
          detailRow("Días vencidos", `<span style="color:#B91C1C;font-weight:700;">${d.days_overdue}</span>`) +
          detailRow("Estado", d.task_status || d.status || "—")
        )}
        <p style="margin:16px 0 0;font-size:14px;color:#374151;">Complete esta tarea inmediatamente para evitar impactar el cronograma de la revisión.</p>`,
    },
    cta: { en: "View Task", es: "Ver Tarea" },
    ctaUrl: (d) => `${d.app_url}/review-cases/${d.review_case_id}?task=${d.task_id}`,
  },

  review_period_approaching: {
    subject: {
      en: (d) => d.days_remaining === 0
        ? `[ValiTrack] ${d.system_name}: Periodic review due TODAY`
        : `[ValiTrack] ${d.system_name}: Periodic review due in ${d.days_remaining} days`,
      es: (d) => d.days_remaining === 0
        ? `[ValiTrack] ${d.system_name}: Revisión periódica vence HOY`
        : `[ValiTrack] ${d.system_name}: Revisión periódica vence en ${d.days_remaining} días`,
    },
    body: {
      en: (d) => {
        const urgency = urgencyBadge(d.days_remaining, "en", false);
        return `${urgency}
          <p style="margin:0 0 16px;font-size:14px;color:#374151;">The next periodic review for <strong>${d.system_name}</strong> (${d.system_identifier || ""}) is ${d.days_remaining === 0 ? "due <strong>today</strong>" : `due in <strong>${d.days_remaining} days</strong>`} (${d.next_review_date}).</p>
          ${detailTable(
            detailRow("System", d.system_name) +
            detailRow("Identifier", d.system_identifier || "—") +
            detailRow("Next Review Date", d.next_review_date) +
            detailRow("Days Remaining", String(d.days_remaining))
          )}
          <p style="margin:16px 0 0;font-size:14px;color:#374151;">Please initiate the review case to ensure timely completion.</p>`;
      },
      es: (d) => {
        const urgency = urgencyBadge(d.days_remaining, "es", false);
        return `${urgency}
          <p style="margin:0 0 16px;font-size:14px;color:#374151;">La próxima revisión periódica de <strong>${d.system_name}</strong> (${d.system_identifier || ""}) ${d.days_remaining === 0 ? "vence <strong>hoy</strong>" : `vence en <strong>${d.days_remaining} días</strong>`} (${d.next_review_date}).</p>
          ${detailTable(
            detailRow("Sistema", d.system_name) +
            detailRow("Identificador", d.system_identifier || "—") +
            detailRow("Fecha próxima revisión", d.next_review_date) +
            detailRow("Días restantes", String(d.days_remaining))
          )}
          <p style="margin:16px 0 0;font-size:14px;color:#374151;">Inicie el caso de revisión para asegurar su completación a tiempo.</p>`;
      },
    },
    cta: { en: "Create Review Case", es: "Crear Caso de Revisión" },
    ctaUrl: (d) => `${d.app_url}/review-cases`,
  },

  completion_deadline_approaching: {
    subject: {
      en: (d) => d.days_remaining === 0
        ? `[ValiTrack] ${d.system_name}: Review completion deadline is TODAY`
        : `[ValiTrack] ${d.system_name}: Review completion deadline in ${d.days_remaining} days`,
      es: (d) => d.days_remaining === 0
        ? `[ValiTrack] ${d.system_name}: Fecha límite de revisión es HOY`
        : `[ValiTrack] ${d.system_name}: Fecha límite de revisión en ${d.days_remaining} días`,
    },
    body: {
      en: (d) => {
        const urgency = urgencyBadge(d.days_remaining, "en", false);
        return `${urgency}
          <p style="margin:0 0 16px;font-size:14px;color:#374151;">The completion deadline for the periodic review of <strong>${d.system_name}</strong> (${d.system_identifier || ""}) is ${d.days_remaining === 0 ? "<strong>today</strong>" : `in <strong>${d.days_remaining} days</strong>`} (${d.due_date}).</p>
          ${detailTable(
            detailRow("System", d.system_name) +
            detailRow("Identifier", d.system_identifier || "—") +
            detailRow("Deadline", d.due_date) +
            detailRow("Review Status", d.review_status || "—") +
            detailRow("Tasks Resolved", `${d.tasks_resolved ?? "—"} / ${d.tasks_total ?? "—"}`)
          )}
          <p style="margin:16px 0 0;font-size:14px;color:#374151;">Please ensure all tasks are completed before the deadline.</p>`;
      },
      es: (d) => {
        const urgency = urgencyBadge(d.days_remaining, "es", false);
        return `${urgency}
          <p style="margin:0 0 16px;font-size:14px;color:#374151;">La fecha límite de completación para la revisión periódica de <strong>${d.system_name}</strong> (${d.system_identifier || ""}) es ${d.days_remaining === 0 ? "<strong>hoy</strong>" : `en <strong>${d.days_remaining} días</strong>`} (${d.due_date}).</p>
          ${detailTable(
            detailRow("Sistema", d.system_name) +
            detailRow("Identificador", d.system_identifier || "—") +
            detailRow("Fecha límite", d.due_date) +
            detailRow("Estado de revisión", d.review_status || "—") +
            detailRow("Tareas resueltas", `${d.tasks_resolved ?? "—"} / ${d.tasks_total ?? "—"}`)
          )}
          <p style="margin:16px 0 0;font-size:14px;color:#374151;">Asegúrese de que todas las tareas estén completadas antes de la fecha límite.</p>`;
      },
    },
    cta: { en: "View Review Case", es: "Ver Caso de Revisión" },
    ctaUrl: (d) => `${d.app_url}/review-cases/${d.review_case_id}`,
  },

  review_period_overdue: {
    subject: {
      en: (d) => `[ValiTrack] OVERDUE: ${d.system_name} periodic review (${d.days_overdue} days past due)`,
      es: (d) => `[ValiTrack] VENCIDA: Revisión periódica de ${d.system_name} (${d.days_overdue} días de retraso)`,
    },
    body: {
      en: (d) => `${urgencyBadge(-1, "en", true)}
        <p style="margin:0 0 16px;font-size:14px;color:#B91C1C;font-weight:600;">The periodic review for <strong>${d.system_name}</strong> (${d.system_identifier || ""}) is overdue by ${d.days_overdue} day(s).</p>
        ${detailTable(
          detailRow("System", d.system_name) +
          detailRow("Identifier", d.system_identifier || "—") +
          detailRow("Original Review Date", d.next_review_date) +
          detailRow("Days Overdue", `<span style="color:#B91C1C;font-weight:700;">${d.days_overdue}</span>`)
        )}
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">The review was due on ${d.next_review_date} but no review case has been created. This may result in a regulatory non-conformity.</p>
        <p style="margin:0;font-size:14px;color:#374151;font-weight:600;">Please create a review case immediately.</p>`,
      es: (d) => `${urgencyBadge(-1, "es", true)}
        <p style="margin:0 0 16px;font-size:14px;color:#B91C1C;font-weight:600;">La revisión periódica de <strong>${d.system_name}</strong> (${d.system_identifier || ""}) está vencida por ${d.days_overdue} día(s).</p>
        ${detailTable(
          detailRow("Sistema", d.system_name) +
          detailRow("Identificador", d.system_identifier || "—") +
          detailRow("Fecha de revisión original", d.next_review_date) +
          detailRow("Días vencidos", `<span style="color:#B91C1C;font-weight:700;">${d.days_overdue}</span>`)
        )}
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">La revisión debía realizarse el ${d.next_review_date} pero no se ha creado un caso de revisión. Esto puede resultar en una no-conformidad regulatoria.</p>
        <p style="margin:0;font-size:14px;color:#374151;font-weight:600;">Cree un caso de revisión inmediatamente.</p>`,
    },
    cta: { en: "Create Review Case", es: "Crear Caso de Revisión" },
    ctaUrl: (d) => `${d.app_url}/review-cases`,
  },

  // ── Phase 4: Escalation + Digest + Account ────────────────
  escalation_task_overdue: {
    subject: {
      en: (d) => `[ValiTrack] ESCALATION: ${d.assignee_name}'s task overdue ${d.days_overdue} days: ${d.task_title}`,
      es: (d) => `[ValiTrack] ESCALAMIENTO: Tarea de ${d.assignee_name} vencida ${d.days_overdue} días: ${d.task_title}`,
    },
    body: {
      en: (d) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr><td style="background:#B91C1C;border-radius:6px;padding:10px 16px;text-align:center;">
            <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">⚠️ ESCALATION — TASK OVERDUE &gt;7 DAYS</span>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">A task assigned to <strong>${d.assignee_name}</strong> has been overdue for <strong style="color:#B91C1C;">${d.days_overdue} days</strong> and requires your attention as System Owner.</p>
        ${detailTable(
          detailRow("Task", d.task_title) +
          detailRow("Assignee", d.assignee_name) +
          detailRow("System", `${d.system_name} (${d.system_identifier || ""})`) +
          detailRow("Due Date", d.due_date) +
          detailRow("Days Overdue", `<span style="color:#B91C1C;font-weight:700;">${d.days_overdue}</span>`)
        )}
        <p style="margin:16px 0 0;font-size:14px;color:#374151;">Consider reassigning this task or contacting the assignee directly to prevent further delays.</p>`,
      es: (d) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr><td style="background:#B91C1C;border-radius:6px;padding:10px 16px;text-align:center;">
            <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">⚠️ ESCALAMIENTO — TAREA VENCIDA &gt;7 DÍAS</span>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">Una tarea asignada a <strong>${d.assignee_name}</strong> ha estado vencida por <strong style="color:#B91C1C;">${d.days_overdue} días</strong> y requiere su atención como System Owner.</p>
        ${detailTable(
          detailRow("Tarea", d.task_title) +
          detailRow("Asignado", d.assignee_name) +
          detailRow("Sistema", `${d.system_name} (${d.system_identifier || ""})`) +
          detailRow("Fecha límite", d.due_date) +
          detailRow("Días vencidos", `<span style="color:#B91C1C;font-weight:700;">${d.days_overdue}</span>`)
        )}
        <p style="margin:16px 0 0;font-size:14px;color:#374151;">Considere reasignar esta tarea o contactar al asignado directamente para prevenir más retrasos.</p>`,
    },
    cta: { en: "View Task", es: "Ver Tarea" },
    ctaUrl: (d) => `${d.app_url}/review-cases/${d.review_case_id}?task=${d.resource_id}`,
  },

  escalation_deadline_overdue: {
    subject: {
      en: (d) => `[ValiTrack] ESCALATION: ${d.system_name} review deadline overdue (${d.days_overdue} days)`,
      es: (d) => `[ValiTrack] ESCALAMIENTO: Fecha límite de revisión de ${d.system_name} vencida (${d.days_overdue} días)`,
    },
    body: {
      en: (d) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr><td style="background:#B91C1C;border-radius:6px;padding:10px 16px;text-align:center;">
            <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">⚠️ ESCALATION — REVIEW DEADLINE OVERDUE</span>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;font-size:14px;color:#B91C1C;font-weight:600;">The completion deadline for the periodic review of <strong>${d.system_name}</strong> (${d.system_identifier || ""}) has passed by <strong>${d.days_overdue} days</strong>.</p>
        ${detailTable(
          detailRow("System", `${d.system_name} (${d.system_identifier || ""})`) +
          detailRow("System Owner", d.so_name || "—") +
          detailRow("Deadline", d.due_date) +
          detailRow("Days Overdue", `<span style="color:#B91C1C;font-weight:700;">${d.days_overdue}</span>`) +
          detailRow("Review Status", d.review_status) +
          detailRow("Tasks Resolved", `${d.tasks_resolved} / ${d.tasks_total}`)
        )}
        <p style="margin:16px 0 0;font-size:14px;color:#B91C1C;font-weight:600;">Immediate action is required to prevent a regulatory non-conformity.</p>`,
      es: (d) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr><td style="background:#B91C1C;border-radius:6px;padding:10px 16px;text-align:center;">
            <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">⚠️ ESCALAMIENTO — FECHA LÍMITE VENCIDA</span>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;font-size:14px;color:#B91C1C;font-weight:600;">La fecha límite de completación para la revisión periódica de <strong>${d.system_name}</strong> (${d.system_identifier || ""}) ha pasado por <strong>${d.days_overdue} días</strong>.</p>
        ${detailTable(
          detailRow("Sistema", `${d.system_name} (${d.system_identifier || ""})`) +
          detailRow("System Owner", d.so_name || "—") +
          detailRow("Fecha límite", d.due_date) +
          detailRow("Días vencidos", `<span style="color:#B91C1C;font-weight:700;">${d.days_overdue}</span>`) +
          detailRow("Estado de revisión", d.review_status) +
          detailRow("Tareas resueltas", `${d.tasks_resolved} / ${d.tasks_total}`)
        )}
        <p style="margin:16px 0 0;font-size:14px;color:#B91C1C;font-weight:600;">Se requiere acción inmediata para prevenir una no-conformidad regulatoria.</p>`,
    },
    cta: { en: "View Review Case", es: "Ver Caso de Revisión" },
    ctaUrl: (d) => `${d.app_url}/review-cases/${d.review_case_id}`,
  },

  digest_so_weekly: {
    subject: {
      en: (d) => `[ValiTrack] Weekly Review Summary — ${d.digest_date}`,
      es: (d) => `[ValiTrack] Resumen Semanal de Revisiones — ${d.digest_date}`,
    },
    body: {
      en: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Here is your weekly summary of periodic review activity across your systems.</p>${d.summary_html}`,
      es: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Aquí está su resumen semanal de la actividad de revisiones periódicas de sus sistemas.</p>${d.summary_html}`,
    },
    cta: { en: "Open Dashboard", es: "Abrir Dashboard" },
    ctaUrl: (d) => `${d.app_url}/dashboard`,
  },

  digest_qa_weekly: {
    subject: {
      en: (d) => `[ValiTrack] Weekly QA Summary — ${d.digest_date}`,
      es: (d) => `[ValiTrack] Resumen Semanal QA — ${d.digest_date}`,
    },
    body: {
      en: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Here is your weekly summary of pending approvals and overdue items requiring QA attention.</p>${d.summary_html}`,
      es: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Aquí está su resumen semanal de aprobaciones pendientes y elementos vencidos que requieren atención de QA.</p>${d.summary_html}`,
    },
    cta: { en: "Open Intray", es: "Abrir Intray" },
    ctaUrl: (d) => `${d.app_url}/intray`,
  },

  account_welcome: {
    subject: {
      en: () => "Welcome to ValiTrack — Your account has been created",
      es: () => "Bienvenido a ValiTrack — Tu cuenta ha sido creada",
    },
    body: {
      en: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Your ValiTrack account has been created. You can now log in and begin working on your assigned periodic review tasks.</p>
        ${detailTable(
          detailRow("Email", d.email) +
          detailRow("Role", ROLE_LABELS[d.role] || d.role)
        )}
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;background:#F0FDF4;border:1px solid #86EFAC;border-radius:6px;">
          <tr><td style="padding:16px;">
            <p style="margin:0 0 6px;font-size:12px;color:#15803D;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Temporary Password</p>
            <p style="margin:0;font-size:18px;font-family:'Courier New',monospace;color:#1F2937;font-weight:700;letter-spacing:1px;">${d.temporary_password || "—"}</p>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-size:14px;color:#B45309;font-weight:600;">⚠️ You will be required to change your password on first login.</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">Do not share your credentials. If you did not expect this email, contact your system administrator.</p>`,
      es: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Su cuenta de ValiTrack ha sido creada. Ya puede iniciar sesión y comenzar a trabajar en sus tareas de revisión periódica asignadas.</p>
        ${detailTable(
          detailRow("Email", d.email) +
          detailRow("Rol", ROLE_LABELS[d.role] || d.role)
        )}
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;background:#F0FDF4;border:1px solid #86EFAC;border-radius:6px;">
          <tr><td style="padding:16px;">
            <p style="margin:0 0 6px;font-size:12px;color:#15803D;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Contraseña Temporal</p>
            <p style="margin:0;font-size:18px;font-family:'Courier New',monospace;color:#1F2937;font-weight:700;letter-spacing:1px;">${d.temporary_password || "—"}</p>
          </td></tr>
        </table>
        <p style="margin:0 0 8px;font-size:14px;color:#B45309;font-weight:600;">⚠️ Se le pedirá que cambie su contraseña en el primer inicio de sesión.</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">No comparta sus credenciales. Si no esperaba este correo, contacte a su administrador del sistema.</p>`,
    },
    cta: { en: "Log In to ValiTrack", es: "Iniciar Sesión en ValiTrack" },
    ctaUrl: (d) => `${d.app_url}/auth`,
  },

  password_reset: {
    subject: {
      en: () => "[ValiTrack] Password Reset Instructions",
      es: () => "[ValiTrack] Instrucciones para Restablecer Contraseña",
    },
    body: {
      en: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">We received a request to reset your password for your ValiTrack account.</p>
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">Click the button below to set a new password:</p>
        <p style="margin:24px 0 8px;font-size:13px;color:#6B7280;">⏱ This link expires in ${d.expires_in_en || "1 hour"}.</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">If you did not request this, you can safely ignore this email. Your password will not be changed.</p>`,
      es: (d) => `<p style="margin:0 0 16px;font-size:14px;color:#374151;">Recibimos una solicitud para restablecer tu contraseña de ValiTrack.</p>
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">Haz clic en el botón a continuación para establecer una nueva contraseña:</p>
        <p style="margin:24px 0 8px;font-size:13px;color:#6B7280;">⏱ Este enlace expira en ${d.expires_in_es || "1 hora"}.</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">Si no solicitaste esto, puedes ignorar este correo. Tu contraseña no será cambiada.</p>`,
    },
    cta: { en: "Reset Password", es: "Restablecer Contraseña" },
    ctaUrl: (d) => d.reset_url,
  },

  account_password_changed: {
    subject: {
      en: () => "[ValiTrack] Your password has been changed",
      es: () => "[ValiTrack] Tu contraseña ha sido cambiada",
    },
    body: {
      en: (d) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr><td style="background:#F59E0B;border-radius:6px;padding:10px 16px;text-align:center;">
            <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">🔒 PASSWORD CHANGED</span>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">Your ValiTrack password has been changed successfully.</p>
        ${d.changed_at ? detailTable(detailRow("Changed At", new Date(d.changed_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))) : ""}
        <p style="margin:16px 0 0;font-size:14px;color:#B45309;font-weight:600;">⚠️ If you did not make this change, contact your system administrator immediately.</p>`,
      es: (d) => `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 20px;">
          <tr><td style="background:#F59E0B;border-radius:6px;padding:10px 16px;text-align:center;">
            <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">🔒 CONTRASEÑA CAMBIADA</span>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">Su contraseña de ValiTrack ha sido cambiada exitosamente.</p>
        ${d.changed_at ? detailTable(detailRow("Fecha del cambio", new Date(d.changed_at).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }))) : ""}
        <p style="margin:16px 0 0;font-size:14px;color:#B45309;font-weight:600;">⚠️ Si usted no realizó este cambio, contacte a su administrador del sistema inmediatamente.</p>`,
    },
  },
};

// ── Build Email Content ──────────────────────────────────────────
function buildEmailContent(
  notificationType: string,
  data: Record<string, any>,
  lang: "en" | "es"
): { subject: string; html: string } {
  const template = EMAIL_TEMPLATES[notificationType];
  if (!template) {
    throw new Error(`Unknown notification type: ${notificationType}`);
  }

  const subject = template.subject[lang](data);
  const body = template.body[lang](data);
  const ctaText = template.cta?.[lang] || null;
  const ctaUrl = template.ctaUrl?.(data) || null;

  const html = wrapInBaseLayout({
    recipientName: data.recipient_name,
    body,
    ctaText,
    ctaUrl,
    lang,
  });

  return { subject, html };
}

// ── Main Handler ─────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate JWT for frontend calls (service-role calls from other Edge Functions skip this)
    const authHeader = req.headers.get("Authorization");
    let callerUserId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      // Check if this is NOT the service_role key (service-role calls are trusted)
      if (token !== SUPABASE_SERVICE_ROLE_KEY) {
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
        if (authError || !user) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        callerUserId = user.id;
      }
    }

    const body = await req.json();
    const { notification_type, recipient_user_id, data, triggered_by } = body;

    // Validate required fields
    if (!notification_type || !recipient_user_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: notification_type, recipient_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate notification type exists
    const validTypes = Object.values(NOTIFICATION_TYPES);
    if (!validTypes.includes(notification_type)) {
      return new Response(JSON.stringify({ error: `Unknown notification_type: ${notification_type}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recipient info
    const { data: recipientData, error: recipientError } = await supabaseClient
      .from("app_users")
      .select("email, full_name")
      .eq("id", recipient_user_id)
      .single();

    if (recipientError || !recipientData) {
      return new Response(JSON.stringify({ error: "Recipient not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch language preference (fallback to 'en')
    const { data: langData } = await supabaseClient
      .from("user_language_preference")
      .select("language_code")
      .eq("user_id", recipient_user_id)
      .maybeSingle();

    const lang = (langData?.language_code === "es" ? "es" : "en") as "en" | "es";

    // Build email content
    const { subject, html } = buildEmailContent(notification_type, {
      ...data,
      recipient_name: recipientData.full_name,
      app_url: VALITRACK_APP_URL,
    }, lang);

    // Send via Resend SDK
    let resendResult: any;
    let success = false;
    let resendId: string | null = null;
    try {
      resendResult = await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: [recipientData.email],
        subject,
        html,
      });
      // Resend SDK returns { data: { id: "..." }, error: null } on success
      if (resendResult?.error) {
        success = false;
      } else if (resendResult?.data?.id) {
        success = true;
        resendId = resendResult.data.id;
      } else {
        // Fallback: check legacy shape { id: "..." }
        success = !!resendResult?.id;
        resendId = resendResult?.id || null;
      }
    } catch (resendError: any) {
      resendResult = { error: resendError.message || String(resendError) };
      success = false;
    }

    // Log to notification_log (service_role bypasses RLS)
    await supabaseClient.from("notification_log").insert({
      notification_type,
      recipient_user_id,
      recipient_email: recipientData.email,
      subject,
      status: success ? "sent" : "failed",
      error_message: success ? null : JSON.stringify(resendResult),
      resend_id: resendId,
      metadata: data || {},
      triggered_by: triggered_by || callerUserId || null,
    });

    if (!success) {
      console.error("Resend SDK error:", resendResult);
      return new Response(JSON.stringify({ error: "Failed to send email", details: resendResult }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, resend_id: resendId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("send-notification error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
