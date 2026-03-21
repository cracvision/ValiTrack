-- Add reassignment columns to review_tasks
ALTER TABLE public.review_tasks
  ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reassigned_by UUID,
  ADD COLUMN IF NOT EXISTS reassigned_from UUID,
  ADD COLUMN IF NOT EXISTS reassignment_reason TEXT;

-- Update note_type CHECK constraint on task_work_notes to include 'reassignment'
ALTER TABLE public.task_work_notes DROP CONSTRAINT IF EXISTS task_work_notes_note_type_check;
ALTER TABLE public.task_work_notes ADD CONSTRAINT task_work_notes_note_type_check
  CHECK (note_type IN ('work_note', 'status_change', 'evidence_upload', 'reopen_reason', 'reassignment'));