-- Add supersede tracking columns to task_evidence_files
ALTER TABLE public.task_evidence_files
  ADD COLUMN IF NOT EXISTS is_superseded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by UUID,
  ADD COLUMN IF NOT EXISTS superseded_reason TEXT;

-- Drop old super-user-only update policy (may already be dropped)
DROP POLICY IF EXISTS "Super users can update evidence records" ON public.task_evidence_files;

-- New policy: assignee, SO, and super_user can update (for supersede)
-- review_cases.system_owner_id is UUID, so no cast needed
CREATE POLICY "Authorized users can update evidence records"
  ON public.task_evidence_files FOR UPDATE TO authenticated
  USING (
    is_deleted = false AND
    EXISTS (
      SELECT 1 FROM public.review_tasks rt
      JOIN public.review_cases rc ON rc.id = rt.review_case_id
      WHERE rt.id = task_evidence_files.task_id
      AND rt.is_deleted = false
      AND rt.status = 'in_progress'
      AND (
        rt.assigned_to = auth.uid() OR
        rc.system_owner_id = auth.uid() OR
        public.has_role(auth.uid(), 'super_user')
      )
    )
  )
  WITH CHECK (
    is_deleted = false
  );

-- Add 'evidence_replaced' to the note_type CHECK constraint on task_work_notes
ALTER TABLE public.task_work_notes DROP CONSTRAINT IF EXISTS task_work_notes_note_type_check;
ALTER TABLE public.task_work_notes ADD CONSTRAINT task_work_notes_note_type_check
  CHECK (note_type = ANY (ARRAY['work_note'::text, 'status_change'::text, 'evidence_upload'::text, 'reopen_reason'::text, 'reassignment'::text, 'evidence_replaced'::text]));