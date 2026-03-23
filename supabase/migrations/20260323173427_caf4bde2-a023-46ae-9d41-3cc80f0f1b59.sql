
-- Add execution_phase to task_templates
ALTER TABLE public.task_templates
  ADD COLUMN IF NOT EXISTS execution_phase INTEGER NOT NULL DEFAULT 1;

-- Add CHECK constraint
ALTER TABLE public.task_templates
  ADD CONSTRAINT task_templates_execution_phase_check
  CHECK (execution_phase IN (1, 2, 3, 4));

COMMENT ON COLUMN public.task_templates.execution_phase IS
  'Execution phase: 1=Initiation, 2=Evidence Gathering, 3=AI Evaluation, 4=Approvals. Tasks in phase N are blocked until all tasks in phases < N are completed.';

-- Add execution_phase to review_tasks
ALTER TABLE public.review_tasks
  ADD COLUMN IF NOT EXISTS execution_phase INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.review_tasks
  ADD CONSTRAINT review_tasks_execution_phase_check
  CHECK (execution_phase IN (1, 2, 3, 4));

COMMENT ON COLUMN public.review_tasks.execution_phase IS
  'Execution phase inherited from task_template at generation time. Controls task execution order enforcement.';

-- Create phase completion check function
CREATE OR REPLACE FUNCTION public.check_task_phase_unlocked(
  p_task_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_case_id UUID;
  v_task_phase INTEGER;
  v_blocking_phase INTEGER;
  v_total_in_phase INTEGER;
  v_completed_in_phase INTEGER;
BEGIN
  SELECT review_case_id, execution_phase
  INTO v_review_case_id, v_task_phase
  FROM public.review_tasks
  WHERE id = p_task_id AND is_deleted = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('unlocked', false, 'error', 'Task not found');
  END IF;

  IF v_task_phase = 1 THEN
    RETURN jsonb_build_object('unlocked', true);
  END IF;

  FOR v_blocking_phase IN 1..(v_task_phase - 1) LOOP
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total_in_phase, v_completed_in_phase
    FROM public.review_tasks
    WHERE review_case_id = v_review_case_id
      AND execution_phase = v_blocking_phase
      AND is_deleted = false;

    IF v_total_in_phase > 0 AND v_completed_in_phase < v_total_in_phase THEN
      RETURN jsonb_build_object(
        'unlocked', false,
        'blocking_phase', v_blocking_phase,
        'blocking_phase_total', v_total_in_phase,
        'blocking_phase_completed', v_completed_in_phase
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('unlocked', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_task_phase_unlocked(UUID) TO authenticated;

COMMENT ON FUNCTION public.check_task_phase_unlocked IS
  'SECURITY DEFINER: Bypasses RLS to check task phase completion. Required to avoid RLS circular dependencies. Returns JSON with unlocked status and blocking phase details.';

-- Create phase summary function
CREATE OR REPLACE FUNCTION public.get_review_case_phase_summary(
  p_review_case_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase INTEGER;
  v_total INTEGER;
  v_completed INTEGER;
  v_phases JSONB := '[]'::jsonb;
BEGIN
  FOR v_phase IN 1..4 LOOP
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total, v_completed
    FROM public.review_tasks
    WHERE review_case_id = p_review_case_id
      AND execution_phase = v_phase
      AND is_deleted = false;

    IF v_total > 0 THEN
      v_phases := v_phases || jsonb_build_object(
        'phase', v_phase,
        'total', v_total,
        'completed', v_completed,
        'is_complete', (v_completed = v_total)
      );
    END IF;
  END LOOP;

  RETURN v_phases;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_review_case_phase_summary(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_review_case_phase_summary IS
  'SECURITY DEFINER: Returns phase completion summary for a review case. Required for cross-task visibility regardless of calling user RLS policies.';
