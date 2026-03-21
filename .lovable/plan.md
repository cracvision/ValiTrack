## ValiTrack — Iteration 3C: Task Execution & Evidence Upload

### Phase 1 — COMPLETED ✅

**Database Migration:**
- Added `completed_by`, `reopened_at`, `reopened_by`, `reopened_reason` columns to `review_tasks`
- Updated status CHECK constraint to only allow `pending`, `in_progress`, `completed`
- Created `task_work_notes` table with full audit trail, soft delete, RLS (SELECT for case participants, INSERT for assignee/SO/super_user, UPDATE for super_user only)
- Updated RLS on `review_tasks` to allow SO to update tasks
- Added reassignment columns: `reassigned_at`, `reassigned_by`, `reassigned_from`, `reassignment_reason`
- Added `reassignment` to `task_work_notes` note_type CHECK constraint

**Types (`src/types/index.ts`):**
- Updated `TaskStatus` to remove `blocked`/`skipped`
- Added `WorkNoteType`, `TaskWorkNote`, `TaskEvidenceFile` types
- Updated `ReviewTask` interface with new columns

**Hooks:**
- `useTaskExecution.ts` — Start/complete/reopen/reassign with auto work notes + audit log
- `useTaskWorkNotes.ts` — CRUD for immutable work notes with user name resolution

**Components:**
- `TaskDetailPanel.tsx` — Sheet slide-over with header, actions, evidence, work log, task details
- `TaskActionButtons.tsx` — Start/Complete/Reopen with authorization + reopen reason dialog
- `TaskWorkLog.tsx` — Note form + immutable note list with type-specific styling
- `TaskReassignDialog.tsx` — Reassign task to same-role user with mandatory reason

**ReviewTasksPanel:**
- Task rows are now clickable → opens TaskDetailPanel
- Completed tasks show green checkmark + muted styling + completed date
- Removed blocked/skipped status styles
- Passes `reviewCaseStatus` for action button gating

**ReviewActionButtons:**
- Blocks `in_progress → execution_review` transition until ALL tasks are completed

**Authorization:**
- Only assignee or super_user can start/complete tasks
- Only SO or super_user can reopen tasks
- Only SO or super_user can reassign tasks
- Non-authorized users see read-only panel with info message

**i18n:** All `tasks.*` keys added in both EN and ES

---

### Phase 2 — COMPLETED ✅

**Database Migration:**
- Created `task_evidence_files` table with SHA-256 hash, evidence category CHECK (25 categories), version tracking, full audit + soft delete
- RLS: SELECT for review case participants, INSERT for assignee/SO/super_user, UPDATE for super_user only
- Created `review-evidence` private storage bucket (50MB limit, restricted MIME types)
- Storage RLS: INSERT + SELECT for authenticated users

**Hooks:**
- `useTaskEvidenceFiles.ts` — Fetch files, client-side SHA-256 via Web Crypto API, upload to storage, insert metadata, auto work note + audit log, signed download URLs

**Components:**
- `TaskEvidenceSection.tsx` — Drag-and-drop upload zone, category auto-suggestion by task group/title keywords, file list with MIME icon, SHA-256 (copy button), preview/download, no delete buttons (immutable)

**TaskDetailPanel Updates:**
- Evidence section rendered between action buttons and work log for EVIDENCE_GROUPS (INIT, ITSM, QMS, SEC, INFRA, DOC)
- Hidden for AI_EVAL and APPR task groups
- Read-only mode hides upload zone

**Completion Validation:**
- INIT/ITSM/QMS/SEC/INFRA/DOC: ≥1 evidence file AND ≥1 manual work note required
- AI_EVAL: ≥1 manual work note required
- APPR: ≥1 manual work note required
- Validation blocks completion with specific i18n error message
