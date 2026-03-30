
-- Iteration 3E: Task N/A with Justification
-- Note: evidence_replaced already exists in DB data, must be preserved in CHECK constraint

-- 1. Update status CHECK constraint on review_tasks
ALTER TABLE public.review_tasks
  DROP CONSTRAINT IF EXISTS review_tasks_status_check;

ALTER TABLE public.review_tasks
  ADD CONSTRAINT review_tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'not_applicable'));

-- 2. Add N/A columns to review_tasks
ALTER TABLE public.review_tasks
  ADD COLUMN IF NOT EXISTS na_reason TEXT,
  ADD COLUMN IF NOT EXISTS na_marked_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS na_marked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.review_tasks.na_reason IS 'Mandatory justification for marking task N/A (min 10 chars)';
COMMENT ON COLUMN public.review_tasks.na_marked_by IS 'User who marked task as N/A';
COMMENT ON COLUMN public.review_tasks.na_marked_at IS 'Timestamp when task was marked as N/A';

-- 3. Update note_type CHECK constraint (preserving all existing types including evidence_replaced)
ALTER TABLE public.task_work_notes
  DROP CONSTRAINT IF EXISTS task_work_notes_note_type_check;

ALTER TABLE public.task_work_notes
  ADD CONSTRAINT task_work_notes_note_type_check
  CHECK (note_type IN (
    'work_note',
    'status_change',
    'evidence_upload',
    'reopen_reason',
    'reassignment',
    'evidence_replaced',
    'na_justification'
  ));

-- 4. Update check_task_phase_unlocked() to count not_applicable as resolved
CREATE OR REPLACE FUNCTION public.check_task_phase_unlocked(p_task_id UUID)
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
      COUNT(*) FILTER (WHERE status IN ('completed', 'not_applicable'))
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

-- 5. Update get_review_case_phase_summary() to count not_applicable as resolved
CREATE OR REPLACE FUNCTION public.get_review_case_phase_summary(p_review_case_id UUID)
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
      COUNT(*) FILTER (WHERE status IN ('completed', 'not_applicable'))
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
