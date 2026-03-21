## ValiTrack — Iteration 3C: Task Execution & Evidence Upload

### Phase 1 — COMPLETED ✅

**Database Migration:**
- Added `completed_by`, `reopened_at`, `reopened_by`, `reopened_reason` columns to `review_tasks`
- Updated status CHECK constraint to only allow `pending`, `in_progress`, `completed`
- Created `task_work_notes` table with full audit trail, soft delete, RLS (SELECT for case participants, INSERT for assignee/SO/super_user, UPDATE for super_user only)
- Updated RLS on `review_tasks` to allow SO to update tasks

**Types (`src/types/index.ts`):**
- Updated `TaskStatus` to remove `blocked`/`skipped`
- Added `WorkNoteType`, `TaskWorkNote`, `TaskEvidenceFile` types
- Updated `ReviewTask` interface with new columns

**Hooks:**
- `useTaskExecution.ts` — Start/complete/reopen with auto work notes + audit log
- `useTaskWorkNotes.ts` — CRUD for immutable work notes with user name resolution

**Components:**
- `TaskDetailPanel.tsx` — Sheet slide-over with header, actions, work log, task details
- `TaskActionButtons.tsx` — Start/Complete/Reopen with authorization + reopen reason dialog
- `TaskWorkLog.tsx` — Note form + immutable note list with type-specific styling

**ReviewTasksPanel:**
- Task rows are now clickable → opens TaskDetailPanel
- Completed tasks show green checkmark + muted styling + completed date
- Removed blocked/skipped status styles
- Passes `reviewCaseStatus` for action button gating

**i18n:** All `tasks.*` keys added in both EN and ES

---

### Phase 2 — Evidence Upload + Completion Validation (PENDING)

**Remaining work:**
1. DB migration: `task_evidence_files` table + `review-evidence` storage bucket + RLS
2. `useTaskEvidenceFiles.ts` hook with client-side SHA-256 hashing
3. `TaskEvidenceSection.tsx` component with drag-and-drop upload, category auto-suggestion, file list
4. Update `TaskDetailPanel` to include evidence section for evidence-gathering task groups
5. Update completion validation to require evidence files for INIT/ITSM/QMS/SEC/INFRA/DOC groups
