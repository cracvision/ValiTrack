-- Function: get_system_recent_activity
-- Purpose: Retrieves recent audit_log activity for a system profile
--          by traversing through review_cases and related entities.
-- SECURITY DEFINER justification: audit_log SELECT is restricted to super_user by RLS.
--   Dashboard users (SO, SA, QA, BO, IT) need to see activity from ALL roles on their
--   assigned systems. The p_system_id parameter scope-limits the returned data.

CREATE OR REPLACE FUNCTION public.get_system_recent_activity(
  p_system_id UUID,
  p_limit INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  resource_type TEXT,
  resource_id UUID,
  user_id UUID,
  user_name TEXT,
  details JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH system_review_cases AS (
    SELECT rc.id AS review_case_id
    FROM public.review_cases rc
    WHERE rc.system_id = p_system_id
  ),
  system_tasks AS (
    SELECT rt.id AS task_id
    FROM public.review_tasks rt
    INNER JOIN system_review_cases src ON rt.review_case_id = src.review_case_id
  ),
  system_review_signoffs AS (
    SELECT rs.id AS signoff_id
    FROM public.review_signoffs rs
    INNER JOIN system_review_cases src ON rs.review_case_id = src.review_case_id
  ),
  profile_signoff_ids AS (
    SELECT ps.id AS signoff_id
    FROM public.profile_signoffs ps
    WHERE ps.system_profile_id = p_system_id
  ),
  relevant_resource_ids AS (
    SELECT review_case_id AS rid FROM system_review_cases
    UNION ALL
    SELECT task_id FROM system_tasks
    UNION ALL
    SELECT signoff_id FROM system_review_signoffs
    UNION ALL
    SELECT signoff_id FROM profile_signoff_ids
    UNION ALL
    SELECT p_system_id
  )
  SELECT
    al.id,
    al.action,
    al.resource_type,
    al.resource_id,
    al.user_id,
    COALESCE(au.full_name, 'System') AS user_name,
    al.details,
    al.created_at
  FROM public.audit_log al
  LEFT JOIN public.app_users au ON al.user_id = au.id
  WHERE al.resource_id IN (SELECT rid FROM relevant_resource_ids)
  ORDER BY al.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_recent_activity(UUID, INTEGER) TO authenticated;