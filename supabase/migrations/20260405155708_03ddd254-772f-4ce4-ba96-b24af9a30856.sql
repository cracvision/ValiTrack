CREATE OR REPLACE FUNCTION public.get_ai_queued_tasks()
RETURNS TABLE (
  task_id          UUID,
  task_title       TEXT,
  task_group       TEXT,
  review_case_id   UUID,
  assigned_to      UUID,
  system_name      TEXT,
  period_start     DATE,
  period_end       DATE,
  risk_level       TEXT,
  gamp_category    TEXT,
  review_level     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_user'::app_role) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT
    rt.id                AS task_id,
    rt.title             AS task_title,
    rt.task_group,
    rt.review_case_id,
    rt.assigned_to,
    sp.name              AS system_name,
    rc.review_period_start AS period_start,
    rc.review_period_end   AS period_end,
    sp.risk_level,
    sp.gamp_category,
    rc.review_level
  FROM review_tasks rt
  JOIN review_cases rc ON rc.id = rt.review_case_id
  JOIN system_profiles sp ON sp.id = rc.system_id
  WHERE rt.status = 'ai_queued'
    AND rt.is_deleted = false
    AND rc.is_deleted = false
    AND sp.is_deleted = false
  ORDER BY rt.updated_at ASC;
END;
$$;