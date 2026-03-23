
-- ==============================================
-- 3C-Fix-2: Instruction Step Checkoffs (ALCOA+)
-- ==============================================

-- 1. New table: task_instruction_checkoffs
CREATE TABLE public.task_instruction_checkoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.review_tasks(id),
  step_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  CONSTRAINT step_index_positive CHECK (step_index >= 1)
);

-- Partial unique: only one active checkoff per task+step
CREATE UNIQUE INDEX uq_task_step_active
  ON public.task_instruction_checkoffs (task_id, step_index)
  WHERE is_deleted = false;

-- updated_at trigger
CREATE TRIGGER update_task_instruction_checkoffs_updated_at
  BEFORE UPDATE ON public.task_instruction_checkoffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
COMMENT ON TABLE public.task_instruction_checkoffs IS
  'ALCOA+ compliant instruction step checkoffs. Each check = INSERT, uncheck = soft delete (is_deleted=true). Re-check = new INSERT. Full history preserved.';
COMMENT ON COLUMN public.task_instruction_checkoffs.step_index IS
  '1-based index matching the numbered step in execution_instructions text. Step "1. ..." = step_index 1.';

-- 2. RLS
ALTER TABLE public.task_instruction_checkoffs ENABLE ROW LEVEL SECURITY;

-- SELECT: same visibility as task_work_notes
CREATE POLICY "Users can view checkoffs for their review case tasks"
  ON public.task_instruction_checkoffs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.review_tasks rt
      JOIN public.review_cases rc ON rc.id = rt.review_case_id
      WHERE rt.id = task_instruction_checkoffs.task_id
        AND rt.is_deleted = false
        AND rc.is_deleted = false
        AND (
          rt.assigned_to = auth.uid()
          OR rc.system_owner_id = auth.uid()
          OR rc.system_admin_id = auth.uid()
          OR rc.qa_id = auth.uid()
          OR rc.business_owner_id = auth.uid()
          OR rc.it_manager_id = auth.uid()
          OR rc.initiated_by = auth.uid()
          OR public.has_role(auth.uid(), 'super_user')
        )
    )
  );

-- INSERT: assignee, SO, or super_user
CREATE POLICY "Users can create checkoffs on their tasks"
  ON public.task_instruction_checkoffs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.review_tasks rt
      JOIN public.review_cases rc ON rc.id = rt.review_case_id
      WHERE rt.id = task_instruction_checkoffs.task_id
        AND rt.is_deleted = false
        AND rt.status = 'in_progress'
        AND (
          rt.assigned_to = auth.uid()
          OR rc.system_owner_id = auth.uid()
          OR public.has_role(auth.uid(), 'super_user')
        )
    )
  );

-- UPDATE (soft delete for unchecking): assignee, SO, or super_user AND task must be in_progress
CREATE POLICY "Users can uncheck steps on active tasks"
  ON public.task_instruction_checkoffs FOR UPDATE TO authenticated
  USING (
    is_deleted = false
    AND EXISTS (
      SELECT 1 FROM public.review_tasks rt
      JOIN public.review_cases rc ON rc.id = rt.review_case_id
      WHERE rt.id = task_instruction_checkoffs.task_id
        AND rt.is_deleted = false
        AND rt.status = 'in_progress'
        AND (
          rt.assigned_to = auth.uid()
          OR rc.system_owner_id = auth.uid()
          OR public.has_role(auth.uid(), 'super_user')
        )
    )
  );

-- 3. Add instruction_step_count to task_templates and review_tasks
ALTER TABLE public.task_templates
  ADD COLUMN IF NOT EXISTS instruction_step_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.review_tasks
  ADD COLUMN IF NOT EXISTS instruction_step_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.task_templates.instruction_step_count IS
  'Number of numbered steps in execution_instructions. Counted by matching lines starting with a digit followed by a period.';
COMMENT ON COLUMN public.review_tasks.instruction_step_count IS
  'Number of instruction steps copied from template at generation time. Used for completion gate validation.';

-- 4. Populate instruction_step_count for existing templates
-- Count lines matching pattern "N. " (digit(s) followed by period and space)
UPDATE public.task_templates
SET instruction_step_count = (
  SELECT COUNT(*)
  FROM regexp_matches(execution_instructions, '^\d+\.', 'gm')
)
WHERE is_deleted = false
  AND is_active = true
  AND execution_instructions IS NOT NULL
  AND execution_instructions != '';

-- 5. Backfill existing review_tasks from templates
UPDATE public.review_tasks rt
SET instruction_step_count = tt.instruction_step_count
FROM public.task_templates tt
WHERE rt.template_id = tt.id
  AND rt.is_deleted = false
  AND tt.is_deleted = false;

-- 6. Grant
GRANT SELECT, INSERT, UPDATE ON public.task_instruction_checkoffs TO authenticated;
