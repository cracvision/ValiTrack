-- Phase 1: Task Execution — Add missing columns to review_tasks + create task_work_notes

-- 1. Add missing execution columns to review_tasks
ALTER TABLE public.review_tasks
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reopened_reason TEXT;

-- 2. Update status CHECK constraint to remove blocked/skipped
ALTER TABLE public.review_tasks DROP CONSTRAINT IF EXISTS review_tasks_status_check;
ALTER TABLE public.review_tasks ADD CONSTRAINT review_tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed'));

-- 3. Create task_work_notes table — immutable work log entries (ALCOA+ compliance)
CREATE TABLE public.task_work_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.review_tasks(id),
  content TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'work_note' CHECK (note_type IN (
    'work_note',
    'status_change',
    'evidence_upload',
    'reopen_reason'
  )),

  -- Audit columns (MANDATORY)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),

  -- Soft delete (MANDATORY — but should NEVER be used in practice)
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_task_work_notes_task ON public.task_work_notes(task_id);
CREATE INDEX idx_task_work_notes_created ON public.task_work_notes(task_id, created_at);

CREATE TRIGGER set_task_work_notes_updated_at
  BEFORE UPDATE ON public.task_work_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.task_work_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: Users involved in the review case can view notes
-- review_cases stores role IDs as UUID, so compare directly with auth.uid()
CREATE POLICY "Users can view notes for their review case tasks"
  ON public.task_work_notes FOR SELECT TO authenticated
  USING (
    is_deleted = false AND
    EXISTS (
      SELECT 1 FROM public.review_tasks rt
      JOIN public.review_cases rc ON rc.id = rt.review_case_id
      WHERE rt.id = task_work_notes.task_id
        AND rt.is_deleted = false
        AND rc.is_deleted = false
        AND (
          rt.assigned_to = auth.uid() OR
          rc.system_owner_id = auth.uid() OR
          rc.system_admin_id = auth.uid() OR
          rc.qa_id = auth.uid() OR
          rc.business_owner_id = auth.uid() OR
          rc.it_manager_id = auth.uid() OR
          rc.initiated_by = auth.uid() OR
          public.has_role(auth.uid(), 'super_user')
        )
    )
  );

-- INSERT: Assignee, SO, or super_user can add notes
CREATE POLICY "Users can add notes to their tasks"
  ON public.task_work_notes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.review_tasks rt
      JOIN public.review_cases rc ON rc.id = rt.review_case_id
      WHERE rt.id = task_work_notes.task_id
        AND rt.is_deleted = false
        AND (
          rt.assigned_to = auth.uid() OR
          rc.system_owner_id = auth.uid() OR
          public.has_role(auth.uid(), 'super_user')
        )
    )
  );

-- UPDATE: ONLY super_user (for extreme audit cases only)
CREATE POLICY "Super users can update notes"
  ON public.task_work_notes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_user'));