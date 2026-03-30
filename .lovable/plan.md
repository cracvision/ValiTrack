
# Evidence File Replacement (Supersede) Feature — COMPLETED

## Summary
ALCOA+-compliant evidence file supersede/replace feature. Original files are never deleted — marked as superseded with mandatory reason, timestamp, and user. Replacement uploaded as new record with `replaces_file_id` and incremented `version`.

## Completed Changes

### 1. Database Migration
- Added `is_superseded`, `superseded_at`, `superseded_by`, `superseded_reason` to `task_evidence_files`
- Replaced `Super users can update evidence records` RLS policy with `Authorized users can update evidence records` (assignee, SO, super_user — scoped to `in_progress` tasks)
- Note: `review_cases.system_owner_id` is UUID (not TEXT like `system_profiles`), so no `::text` cast needed in this policy
- Added `evidence_replaced` to `task_work_notes.note_type` CHECK constraint

### 2. Types (`src/types/index.ts`)
- Added `is_superseded`, `superseded_at`, `superseded_by`, `superseded_reason` to `TaskEvidenceFile`
- Added `evidence_replaced` to `WorkNoteType`

### 3. Hook (`src/hooks/useTaskEvidenceFiles.ts`)
- Query maps new supersede fields from DB
- Resolves `superseded_by` user names
- `fileCount` excludes superseded files (completion validation)
- New `supersedeFile` mutation with rollback if upload fails
- Exported `calculateSHA256` for reuse

### 4. New Component (`src/components/tasks/ReplaceEvidenceDialog.tsx`)
- Dialog with original file info, mandatory reason (min 10 chars), file picker, category dropdown
- Calls `supersedeFile` mutation

### 5. UI (`src/components/tasks/TaskEvidenceSection.tsx`)
- Replace button (RefreshCw icon) on active files when task is `in_progress` and user is authorized
- Active/superseded file split
- "Show N superseded file(s)" toggle
- Superseded files: dimmed, line-through, badge, reason, who/when, download still available
- Version badge on replacement files

### 6. TaskDetailPanel
- Passes `taskStatus` and `canExecuteTask` to `TaskEvidenceSection`

### 7. i18n
- `tasks.evidence.replace.*` keys in EN and ES

## Files Changed
| File | Action |
|------|--------|
| `supabase/migrations/..._add_evidence_supersede.sql` | CREATE |
| `src/types/index.ts` | MODIFY |
| `src/hooks/useTaskEvidenceFiles.ts` | REWRITE |
| `src/components/tasks/ReplaceEvidenceDialog.tsx` | CREATE |
| `src/components/tasks/TaskEvidenceSection.tsx` | REWRITE |
| `src/components/tasks/TaskDetailPanel.tsx` | MODIFY |
| `src/locales/en/common.json` | MODIFY |
| `src/locales/es/common.json` | MODIFY |
