-- 1. Extend review_tasks status CHECK constraint for AI execution
ALTER TABLE public.review_tasks
  DROP CONSTRAINT IF EXISTS review_tasks_status_check;

ALTER TABLE public.review_tasks
  ADD CONSTRAINT review_tasks_status_check
  CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'not_applicable',
    'ai_queued',
    'ai_processing',
    'ai_complete'
  ));

-- 2. Create ai_task_results table
CREATE TABLE public.ai_task_results (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id                   UUID NOT NULL REFERENCES public.review_tasks(id),
  review_case_id            UUID NOT NULL REFERENCES public.review_cases(id),
  model_name                TEXT NOT NULL,
  model_digest              TEXT NOT NULL,
  prompt_template_id        TEXT NOT NULL,
  triggered_by              UUID NOT NULL REFERENCES auth.users(id),
  processing_started_at     TIMESTAMPTZ,
  processing_completed_at   TIMESTAMPTZ,
  processing_duration_sec   INTEGER,
  evidence_files_used       JSONB NOT NULL DEFAULT '[]',
  analysis_result           JSONB,
  execution_status          TEXT NOT NULL
    CHECK (execution_status IN ('queued','processing','complete','failed')),
  error_message             TEXT,
  reviewed_by               UUID REFERENCES auth.users(id),
  reviewed_at               TIMESTAMPTZ,
  reviewer_notes            TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by                UUID NOT NULL REFERENCES auth.users(id),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                UUID REFERENCES auth.users(id),
  is_deleted                BOOLEAN NOT NULL DEFAULT false,
  deleted_at                TIMESTAMPTZ,
  deleted_by                UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_ai_task_results_task   ON public.ai_task_results(task_id);
CREATE INDEX idx_ai_task_results_case   ON public.ai_task_results(review_case_id);
CREATE INDEX idx_ai_task_results_status ON public.ai_task_results(execution_status);

CREATE TRIGGER set_ai_task_results_updated_at
  BEFORE UPDATE ON public.ai_task_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ai_task_results ENABLE ROW LEVEL SECURITY;

-- SELECT: review case participants can view results
CREATE POLICY "ai_task_results_select"
  ON public.ai_task_results FOR SELECT TO authenticated
  USING (
    is_deleted = false AND
    EXISTS (
      SELECT 1 FROM public.review_cases rc
      WHERE rc.id = ai_task_results.review_case_id
      AND rc.is_deleted = false
      AND (
        rc.system_owner_id   = auth.uid()
        OR rc.system_admin_id  = auth.uid()
        OR rc.qa_id            = auth.uid()
        OR rc.business_owner_id = auth.uid()
        OR rc.it_manager_id    = auth.uid()
        OR rc.initiated_by     = auth.uid()
        OR public.has_role(auth.uid(), 'super_user')
      )
    )
  );

-- UPDATE: super_user only (for soft-delete)
CREATE POLICY "ai_task_results_superuser_update"
  ON public.ai_task_results FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_user'));

-- No INSERT policy — worker uses service_role key

-- 3. queue_ai_task RPC
CREATE OR REPLACE FUNCTION public.queue_ai_task(
  p_task_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task      review_tasks%ROWTYPE;
  v_user_name TEXT;
BEGIN
  SELECT * INTO v_task FROM review_tasks WHERE id = p_task_id AND is_deleted = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;

  IF v_task.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Task must be in pending status to queue for AI. Current: ' || v_task.status);
  END IF;

  IF v_task.task_group != 'AI_EVAL' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only AI_EVAL tasks can be queued for AI');
  END IF;

  IF v_task.assigned_to != p_user_id THEN
    IF NOT (
      EXISTS (SELECT 1 FROM review_cases rc
              WHERE rc.id = v_task.review_case_id
              AND rc.system_owner_id = p_user_id)
      OR public.has_role(p_user_id, 'super_user')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions to queue this task');
    END IF;
  END IF;

  SELECT COALESCE(full_name, email) INTO v_user_name
  FROM app_users WHERE id = p_user_id;

  UPDATE review_tasks SET
    status     = 'ai_queued',
    updated_at = now(),
    updated_by = p_user_id
  WHERE id = p_task_id;

  INSERT INTO task_work_notes (task_id, note_type, content, created_by, updated_by)
  VALUES (
    p_task_id,
    'status_change',
    'AI analysis queued by ' || v_user_name || '. Waiting for AI agent to process.',
    p_user_id,
    p_user_id
  );

  INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (
    p_user_id,
    'AI_TASK_QUEUED',
    'review_task',
    p_task_id,
    jsonb_build_object('task_group', v_task.task_group, 'review_case_id', v_task.review_case_id)
  );

  RETURN jsonb_build_object('success', true, 'task_id', p_task_id);
END;
$$;