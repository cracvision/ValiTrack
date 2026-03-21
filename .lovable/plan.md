

## Phase 2 — Evidence Upload + SHA-256 + Completion Validation

### What exists (Phase 1 — done)
- `task_work_notes` table + RLS ✅
- `useTaskExecution.ts` with start/complete/reopen + reassign ✅
- `useTaskWorkNotes.ts` ✅
- `TaskDetailPanel.tsx`, `TaskActionButtons.tsx`, `TaskWorkLog.tsx`, `TaskReassignDialog.tsx` ✅
- `EVIDENCE_GROUPS` constant already defined in TaskDetailPanel ✅
- i18n keys for `tasks.evidence.*` and `tasks.validation.*` already added ✅

### What needs to be built

**Step 1: Database Migration**
- Create `task_evidence_files` table (id, task_id, file_name, file_size_bytes, mime_type, storage_path, sha256_hash, evidence_category with CHECK constraint for 25 categories, description, version, replaces_file_id, full audit + soft delete columns)
- RLS: SELECT for review case participants, INSERT for assignee/SO/super_user, UPDATE for super_user only
- Create `review-evidence` storage bucket (private, 50MB limit, restricted MIME types: PDF, PNG, JPEG, TIFF, XLSX, DOCX, CSV, TXT, ZIP)
- Storage RLS: INSERT + SELECT for authenticated users on `review-evidence` bucket
- Indexes on `task_id`
- `updated_at` trigger

**Step 2: Hook — `src/hooks/useTaskEvidenceFiles.ts`**
- Fetch files for a task (sorted by `created_at` DESC) with user name resolution via `useResolveUserNames`
- `uploadFile(file, category, description?)`:
  1. Client-side SHA-256 via `crypto.subtle.digest()`
  2. Upload to storage: path `{review_case_id}/{task_id}/{timestamp}_{filename}`
  3. Insert metadata into `task_evidence_files`
  4. Auto work note: `"Evidence uploaded: {filename} ({size}, SHA-256: {first16}...)"`
  5. Audit log entry
- `getDownloadUrl(storagePath)`: signed URL via `supabase.storage.createSignedUrl()`
- `fileCount` for validation

**Step 3: Component — `src/components/tasks/TaskEvidenceSection.tsx`**
- Upload zone: drag-and-drop + "Upload Evidence" button
- Category dropdown with auto-suggestion based on task group/title keywords
- Optional description field
- File list: icon by MIME type, name, size (formatted), SHA-256 (first 16 chars + copy button), uploader name, timestamp, category badge, Preview + Download buttons
- No delete buttons (files are immutable)
- Only shown for evidence-gathering groups (INIT, ITSM, QMS, SEC, INFRA, DOC)

**Step 4: Update `TaskDetailPanel.tsx`**
- Import and render `TaskEvidenceSection` between Action Buttons and Work Log
- Only show for task groups in `EVIDENCE_GROUPS`
- Pass `canUpload` (assignee or super_user) and `reviewCaseId` props
- Read-only mode hides upload zone

**Step 5: Update `useTaskExecution.ts` — Completion Validation**
- Before allowing `completeTask()`, validate:
  - INIT/ITSM/QMS/SEC/INFRA/DOC: ≥1 evidence file AND ≥1 manual work note
  - AI_EVAL: ≥1 manual work note (no evidence required)
  - APPR: ≥1 manual work note (no evidence required)
- If validation fails: show toast with the specific i18n error message, do NOT transition

**Step 6: Evidence Category Auto-Suggestion**
- Map task group + title keywords to default category (e.g., ITSM + "incident" → `incident_report`, SEC + "access" → `user_access_list`)
- Fallback to `other` if no keyword match

### Files summary
| File | Action |
|------|--------|
| New migration | CREATE — `task_evidence_files` + storage bucket + RLS |
| `src/hooks/useTaskEvidenceFiles.ts` | CREATE |
| `src/components/tasks/TaskEvidenceSection.tsx` | CREATE |
| `src/components/tasks/TaskDetailPanel.tsx` | MODIFY — add evidence section |
| `src/hooks/useTaskExecution.ts` | MODIFY — add completion validation |

No i18n changes needed — keys were already added in Phase 1.

