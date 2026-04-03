
# ValiTrack — Project Roadmap

## Iteraciones

| # | Módulo | Estado |
|---|--------|--------|
| 1 | Layout + Nav + Tipos + Dashboard básico | ✅ Completado |
| 2 | CRUD System Profiles (DB + approval workflow) | ✅ Completado |
| 3 | Review Cases + Workflow + Tasks + Execution | ✅ Completado |
| 4 | Evidence Vault (upload + hash + supersede) | ✅ Completado |
| 5 | Email Notifications (Resend) | 🔄 En Progreso (Phase 1 ✅) |
| 6 | Auth + Users + RBAC (Lovable Cloud) | ✅ Completado |
| 7 | Hallazgos y Acciones CAPA | 🔲 Pendiente |
| 8 | Reports + Audit Log UI | 🔲 Pendiente |
| 9 | Nueva iteración (por definir) | 🔲 Pendiente |

> **Nota:** La iteración de IA y Automatización (evaluación con AI Agent) ha sido descartada del roadmap. No se implementará.

## Último feature completado

### Email Notifications — Phase 1: Infrastructure — COMPLETED

Notification infrastructure for ValiTrack email alerts via Resend.

**What was built:**
- `notification_log` table (append-only, immutable, FK to `app_users`) with RLS (users see own, super_user sees all, service_role inserts)
- `send-notification` Edge Function — central email sender with 18 bilingual templates (EN/ES), Resend API integration, recipient language detection, full audit logging
- `src/lib/notifications.ts` — fire-and-forget frontend helper with type-safe notification constants

**Phases remaining:**
- Phase 2: Event-driven triggers (task assigned, review initiated, signoff requested, etc.)
- Phase 3: Time-driven triggers (cron: overdue tasks, approaching deadlines)
- Phase 4: Escalation, weekly digests, account notifications (welcome, password changed)
