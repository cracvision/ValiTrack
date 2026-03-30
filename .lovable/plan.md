
# ValiTrack — Project Roadmap

## Iteraciones

| # | Módulo | Estado |
|---|--------|--------|
| 1 | Layout + Nav + Tipos + Dashboard básico | ✅ Completado |
| 2 | CRUD System Profiles (DB + approval workflow) | ✅ Completado |
| 3 | Review Cases + Workflow + Tasks + Execution | ✅ Completado |
| 4 | Evidence Vault (upload + hash + supersede) | ✅ Completado |
| 5 | Hallazgos y Acciones CAPA | 🔲 Pendiente |
| 6 | Auth + Users + RBAC (Lovable Cloud) | ✅ Completado |
| 7 | Reports + Audit Log UI | 🔲 Pendiente |
| 8 | Nueva iteración (por definir) | 🔲 Pendiente |
| 9 | Nueva iteración (por definir) | 🔲 Pendiente |

> **Nota:** La iteración de IA y Automatización (evaluación con AI Agent) ha sido descartada del roadmap. No se implementará.

## Último feature completado

### Evidence File Replacement (Supersede) — COMPLETED
ALCOA+-compliant evidence file supersede/replace feature. Original files are never deleted — marked as superseded with mandatory reason, timestamp, and user. Replacement uploaded as new record with `replaces_file_id` and incremented `version`.

Files changed: migration, `src/types/index.ts`, `useTaskEvidenceFiles.ts`, `ReplaceEvidenceDialog.tsx` (new), `TaskEvidenceSection.tsx`, `TaskDetailPanel.tsx`, i18n EN/ES.
