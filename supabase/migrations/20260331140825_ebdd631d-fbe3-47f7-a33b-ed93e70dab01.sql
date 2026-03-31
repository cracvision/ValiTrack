-- ================================================
-- Iteration 4: Intray RPCs
-- ================================================

-- RPC 1: get_user_intray_items
CREATE OR REPLACE FUNCTION public.get_user_intray_items(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  item_type TEXT,
  item_id UUID,
  assigned_user_id UUID,
  assigned_user_name TEXT,
  review_case_id UUID,
  system_profile_id UUID,
  system_name TEXT,
  system_identifier TEXT,
  review_case_status TEXT,
  title TEXT,
  title_es TEXT,
  description TEXT,
  description_es TEXT,
  item_status TEXT,
  due_date TIMESTAMPTZ,
  item_created_at TIMESTAMPTZ,
  urgency TEXT,
  action_code TEXT,
  context_data JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_super_user BOOLEAN;
  v_target_user_id UUID;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = v_caller_id
    AND role = 'super_user'
  ) INTO v_is_super_user;

  IF p_user_id IS NULL THEN
    IF v_is_super_user THEN
      v_target_user_id := NULL;
    ELSE
      v_target_user_id := v_caller_id;
    END IF;
  ELSE
    IF p_user_id != v_caller_id AND NOT v_is_super_user THEN
      RAISE EXCEPTION 'Access denied: cannot view another user''s intray';
    END IF;
    v_target_user_id := p_user_id;
  END IF;

  RETURN QUERY

  -- SECTION 1: TASKS (pending + in_progress)
  SELECT
    'task'::TEXT AS item_type,
    rt.id AS item_id,
    rt.assigned_to AS assigned_user_id,
    au.full_name AS assigned_user_name,
    rt.review_case_id,
    rc.system_id AS system_profile_id,
    sp.name AS system_name,
    sp.system_identifier,
    rc.status AS review_case_status,
    rt.title,
    rt.title_es,
    rt.task_group AS description,
    rt.task_group AS description_es,
    rt.status AS item_status,
    rt.due_date::TIMESTAMPTZ,
    rt.created_at AS item_created_at,
    CASE
      WHEN rt.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rt.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT AS urgency,
    NULL::TEXT AS action_code,
    jsonb_build_object(
      'execution_phase', rt.execution_phase,
      'task_group', rt.task_group,
      'execution_type', rt.execution_type
    ) AS context_data
  FROM review_tasks rt
  JOIN review_cases rc ON rc.id = rt.review_case_id AND rc.is_deleted = false
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rt.assigned_to
  WHERE rt.is_deleted = false
    AND rt.status IN ('pending', 'in_progress')
    AND (v_target_user_id IS NULL OR rt.assigned_to = v_target_user_id)

  UNION ALL

  -- SECTION 2: REVIEW CASE SIGN-OFFS (pending)
  SELECT
    'review_signoff'::TEXT AS item_type,
    rs.id AS item_id,
    rs.requested_user_id AS assigned_user_id,
    au.full_name AS assigned_user_name,
    rs.review_case_id,
    rc.system_id AS system_profile_id,
    sp.name AS system_name,
    sp.system_identifier,
    rc.status AS review_case_status,
    CASE rs.phase
      WHEN 'plan_review' THEN 'Plan Review Sign-off'
      WHEN 'execution_review' THEN 'Execution Review Sign-off'
    END::TEXT AS title,
    CASE rs.phase
      WHEN 'plan_review' THEN 'Firma de Revisión del Plan'
      WHEN 'execution_review' THEN 'Firma de Revisión de Ejecución'
    END::TEXT AS title_es,
    rs.requested_role AS description,
    rs.requested_role AS description_es,
    rs.status AS item_status,
    rc.due_date::TIMESTAMPTZ,
    rs.created_at AS item_created_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT AS urgency,
    NULL::TEXT AS action_code,
    jsonb_build_object(
      'phase', rs.phase,
      'requested_role', rs.requested_role
    ) AS context_data
  FROM review_signoffs rs
  JOIN review_cases rc ON rc.id = rs.review_case_id AND rc.is_deleted = false
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rs.requested_user_id
  WHERE rs.is_deleted = false
    AND rs.status = 'pending'
    AND (v_target_user_id IS NULL OR rs.requested_user_id = v_target_user_id)

  UNION ALL

  -- SECTION 3: SYSTEM PROFILE SIGN-OFFS (pending)
  SELECT
    'profile_signoff'::TEXT AS item_type,
    ps.id AS item_id,
    ps.requested_user_id AS assigned_user_id,
    au.full_name AS assigned_user_name,
    NULL::UUID AS review_case_id,
    ps.system_profile_id,
    sp.name AS system_name,
    sp.system_identifier,
    sp.status AS review_case_status,
    'System Profile Sign-off'::TEXT AS title,
    'Firma de Perfil de Sistema'::TEXT AS title_es,
    ps.requested_role AS description,
    ps.requested_role AS description_es,
    ps.status AS item_status,
    NULL::TIMESTAMPTZ AS due_date,
    ps.created_at AS item_created_at,
    'upcoming'::TEXT AS urgency,
    NULL::TEXT AS action_code,
    jsonb_build_object(
      'requested_role', ps.requested_role,
      'profile_status', sp.status
    ) AS context_data
  FROM profile_signoffs ps
  JOIN system_profiles sp ON sp.id = ps.system_profile_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = ps.requested_user_id
  WHERE ps.is_deleted = false
    AND ps.status = 'pending'
    AND sp.approval_status = 'in_review'
    AND (v_target_user_id IS NULL OR ps.requested_user_id = v_target_user_id)

  UNION ALL

  -- SECTION 4: SO ACTION — Advance from plan_review
  SELECT
    'action'::TEXT AS item_type,
    rc.id AS item_id,
    rc.system_owner_id AS assigned_user_id,
    au.full_name AS assigned_user_name,
    rc.id AS review_case_id,
    rc.system_id AS system_profile_id,
    sp.name AS system_name,
    sp.system_identifier,
    rc.status AS review_case_status,
    'Advance to Plan Approval'::TEXT AS title,
    'Avanzar a Aprobación del Plan'::TEXT AS title_es,
    'All sign-offs complete'::TEXT AS description,
    'Todas las firmas completadas'::TEXT AS description_es,
    rc.status AS item_status,
    rc.due_date::TIMESTAMPTZ,
    rc.updated_at AS item_created_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT AS urgency,
    'advance_to_plan_approval'::TEXT AS action_code,
    jsonb_build_object('transition_from', 'plan_review', 'transition_to', 'plan_approval') AS context_data
  FROM review_cases rc
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rc.system_owner_id
  WHERE rc.is_deleted = false
    AND rc.status = 'plan_review'
    AND (v_target_user_id IS NULL OR rc.system_owner_id = v_target_user_id)
    AND EXISTS (
      SELECT 1 FROM review_signoffs rs2
      WHERE rs2.review_case_id = rc.id AND rs2.phase = 'plan_review' AND rs2.is_deleted = false
    )
    AND NOT EXISTS (
      SELECT 1 FROM review_signoffs rs2
      WHERE rs2.review_case_id = rc.id AND rs2.phase = 'plan_review' AND rs2.is_deleted = false
      AND rs2.status != 'approved'
    )

  UNION ALL

  -- SECTION 5: QA ACTION — E-Signature Plan Approval
  SELECT
    'action'::TEXT AS item_type,
    rc.id AS item_id,
    rc.qa_id AS assigned_user_id,
    au.full_name AS assigned_user_name,
    rc.id AS review_case_id,
    rc.system_id AS system_profile_id,
    sp.name AS system_name,
    sp.system_identifier,
    rc.status AS review_case_status,
    'Approve Plan (E-Signature)'::TEXT AS title,
    'Aprobar Plan (Firma Electrónica)'::TEXT AS title_es,
    'E-signature required'::TEXT AS description,
    'Se requiere firma electrónica'::TEXT AS description_es,
    rc.status AS item_status,
    rc.due_date::TIMESTAMPTZ,
    rc.updated_at AS item_created_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT AS urgency,
    'approve_plan_esig'::TEXT AS action_code,
    jsonb_build_object('transition_from', 'plan_approval', 'transition_to', 'approved_for_execution', 'requires_esig', true) AS context_data
  FROM review_cases rc
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rc.qa_id
  WHERE rc.is_deleted = false
    AND rc.status = 'plan_approval'
    AND (v_target_user_id IS NULL OR rc.qa_id = v_target_user_id)

  UNION ALL

  -- SECTION 6: SO ACTION — Start Task Execution
  SELECT
    'action'::TEXT AS item_type,
    rc.id AS item_id,
    rc.system_owner_id AS assigned_user_id,
    au.full_name AS assigned_user_name,
    rc.id AS review_case_id,
    rc.system_id AS system_profile_id,
    sp.name AS system_name,
    sp.system_identifier,
    rc.status AS review_case_status,
    'Start Task Execution'::TEXT AS title,
    'Iniciar Ejecución de Tareas'::TEXT AS title_es,
    'Tasks generated, ready to begin'::TEXT AS description,
    'Tareas generadas, listo para comenzar'::TEXT AS description_es,
    rc.status AS item_status,
    rc.due_date::TIMESTAMPTZ,
    rc.updated_at AS item_created_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT AS urgency,
    'start_execution'::TEXT AS action_code,
    jsonb_build_object('transition_from', 'approved_for_execution', 'transition_to', 'in_progress') AS context_data
  FROM review_cases rc
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rc.system_owner_id
  WHERE rc.is_deleted = false
    AND rc.status = 'approved_for_execution'
    AND (v_target_user_id IS NULL OR rc.system_owner_id = v_target_user_id)

  UNION ALL

  -- SECTION 7: SO ACTION — Submit for Final Review
  SELECT
    'action'::TEXT AS item_type,
    rc.id AS item_id,
    rc.system_owner_id AS assigned_user_id,
    au.full_name AS assigned_user_name,
    rc.id AS review_case_id,
    rc.system_id AS system_profile_id,
    sp.name AS system_name,
    sp.system_identifier,
    rc.status AS review_case_status,
    'Submit for Final Review'::TEXT AS title,
    'Enviar a Revisión Final'::TEXT AS title_es,
    'All tasks resolved'::TEXT AS description,
    'Todas las tareas resueltas'::TEXT AS description_es,
    rc.status AS item_status,
    rc.due_date::TIMESTAMPTZ,
    rc.updated_at AS item_created_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT AS urgency,
    'submit_for_final_review'::TEXT AS action_code,
    jsonb_build_object('transition_from', 'in_progress', 'transition_to', 'execution_review') AS context_data
  FROM review_cases rc
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rc.system_owner_id
  WHERE rc.is_deleted = false
    AND rc.status = 'in_progress'
    AND (v_target_user_id IS NULL OR rc.system_owner_id = v_target_user_id)
    AND NOT EXISTS (
      SELECT 1 FROM review_tasks rt2
      WHERE rt2.review_case_id = rc.id
      AND rt2.is_deleted = false
      AND rt2.status NOT IN ('completed', 'not_applicable')
    )
    AND EXISTS (
      SELECT 1 FROM review_tasks rt2
      WHERE rt2.review_case_id = rc.id AND rt2.is_deleted = false
    )

  UNION ALL

  -- SECTION 8: QA ACTION — Final Approval E-Signature
  SELECT
    'action'::TEXT AS item_type,
    rc.id AS item_id,
    rc.qa_id AS assigned_user_id,
    au.full_name AS assigned_user_name,
    rc.id AS review_case_id,
    rc.system_id AS system_profile_id,
    sp.name AS system_name,
    sp.system_identifier,
    rc.status AS review_case_status,
    'Final Approval (E-Signature)'::TEXT AS title,
    'Aprobación Final (Firma Electrónica)'::TEXT AS title_es,
    'E-signature required to approve or reject'::TEXT AS description,
    'Se requiere firma electrónica para aprobar o rechazar'::TEXT AS description_es,
    rc.status AS item_status,
    rc.due_date::TIMESTAMPTZ,
    rc.updated_at AS item_created_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT AS urgency,
    'final_approval_esig'::TEXT AS action_code,
    jsonb_build_object('transition_from', 'execution_review', 'transition_to', 'approved_or_rejected', 'requires_esig', true) AS context_data
  FROM review_cases rc
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rc.qa_id
  WHERE rc.is_deleted = false
    AND rc.status = 'execution_review'
    AND (v_target_user_id IS NULL OR rc.qa_id = v_target_user_id)
    AND EXISTS (
      SELECT 1 FROM review_signoffs rs2
      WHERE rs2.review_case_id = rc.id AND rs2.phase = 'execution_review' AND rs2.is_deleted = false
    )
    AND NOT EXISTS (
      SELECT 1 FROM review_signoffs rs2
      WHERE rs2.review_case_id = rc.id AND rs2.phase = 'execution_review' AND rs2.is_deleted = false
      AND rs2.status != 'approved'
    )

  UNION ALL

  -- SECTION 9: SO ACTION — Approve System Profile
  SELECT
    'action'::TEXT AS item_type,
    sp.id AS item_id,
    sp.system_owner_id::UUID AS assigned_user_id,
    au.full_name AS assigned_user_name,
    NULL::UUID AS review_case_id,
    sp.id AS system_profile_id,
    sp.name AS system_name,
    sp.system_identifier,
    sp.status AS review_case_status,
    'Approve System Profile'::TEXT AS title,
    'Aprobar Perfil de Sistema'::TEXT AS title_es,
    'All sign-offs complete'::TEXT AS description,
    'Todas las firmas completadas'::TEXT AS description_es,
    sp.approval_status AS item_status,
    NULL::TIMESTAMPTZ AS due_date,
    sp.updated_at AS item_created_at,
    'upcoming'::TEXT AS urgency,
    'approve_profile'::TEXT AS action_code,
    jsonb_build_object('transition_from', 'in_review', 'transition_to', 'approved') AS context_data
  FROM system_profiles sp
  LEFT JOIN app_users au ON au.id = sp.system_owner_id::UUID
  WHERE sp.is_deleted = false
    AND sp.approval_status = 'in_review'
    AND (v_target_user_id IS NULL OR sp.system_owner_id::UUID = v_target_user_id)
    AND EXISTS (
      SELECT 1 FROM profile_signoffs ps2
      WHERE ps2.system_profile_id = sp.id AND ps2.is_deleted = false
    )
    AND NOT EXISTS (
      SELECT 1 FROM profile_signoffs ps2
      WHERE ps2.system_profile_id = sp.id AND ps2.is_deleted = false
      AND ps2.status != 'approved'
    )

  ORDER BY
    CASE urgency
      WHEN 'overdue' THEN 1
      WHEN 'due_soon' THEN 2
      WHEN 'upcoming' THEN 3
    END,
    due_date ASC NULLS LAST,
    item_created_at ASC;
END;
$$;


-- ================================================
-- RPC 2: get_user_intray_count
-- ================================================
CREATE OR REPLACE FUNCTION public.get_user_intray_count(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  tasks_count INTEGER,
  signoffs_count INTEGER,
  actions_count INTEGER,
  total_count INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_super_user BOOLEAN;
  v_target_user_id UUID;
  v_tasks INTEGER;
  v_signoffs INTEGER;
  v_actions INTEGER;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = v_caller_id AND role = 'super_user'
  ) INTO v_is_super_user;

  IF p_user_id IS NULL THEN
    IF v_is_super_user THEN
      v_target_user_id := NULL;
    ELSE
      v_target_user_id := v_caller_id;
    END IF;
  ELSE
    IF p_user_id != v_caller_id AND NOT v_is_super_user THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
    v_target_user_id := p_user_id;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_tasks
  FROM review_tasks rt
  JOIN review_cases rc ON rc.id = rt.review_case_id AND rc.is_deleted = false
  WHERE rt.is_deleted = false
    AND rt.status IN ('pending', 'in_progress')
    AND (v_target_user_id IS NULL OR rt.assigned_to = v_target_user_id);

  SELECT (
    (SELECT COUNT(*) FROM review_signoffs rs
     JOIN review_cases rc ON rc.id = rs.review_case_id AND rc.is_deleted = false
     WHERE rs.is_deleted = false AND rs.status = 'pending'
     AND (v_target_user_id IS NULL OR rs.requested_user_id = v_target_user_id))
    +
    (SELECT COUNT(*) FROM profile_signoffs ps
     JOIN system_profiles sp ON sp.id = ps.system_profile_id AND sp.is_deleted = false AND sp.approval_status = 'in_review'
     WHERE ps.is_deleted = false AND ps.status = 'pending'
     AND (v_target_user_id IS NULL OR ps.requested_user_id = v_target_user_id))
  )::INTEGER INTO v_signoffs;

  SELECT (
    (SELECT COUNT(*) FROM review_cases rc
     WHERE rc.is_deleted = false AND rc.status = 'plan_review'
     AND (v_target_user_id IS NULL OR rc.system_owner_id = v_target_user_id)
     AND EXISTS (SELECT 1 FROM review_signoffs rs WHERE rs.review_case_id = rc.id AND rs.phase = 'plan_review' AND rs.is_deleted = false)
     AND NOT EXISTS (SELECT 1 FROM review_signoffs rs WHERE rs.review_case_id = rc.id AND rs.phase = 'plan_review' AND rs.is_deleted = false AND rs.status != 'approved'))
    +
    (SELECT COUNT(*) FROM review_cases rc
     WHERE rc.is_deleted = false AND rc.status = 'plan_approval'
     AND (v_target_user_id IS NULL OR rc.qa_id = v_target_user_id))
    +
    (SELECT COUNT(*) FROM review_cases rc
     WHERE rc.is_deleted = false AND rc.status = 'approved_for_execution'
     AND (v_target_user_id IS NULL OR rc.system_owner_id = v_target_user_id))
    +
    (SELECT COUNT(*) FROM review_cases rc
     WHERE rc.is_deleted = false AND rc.status = 'in_progress'
     AND (v_target_user_id IS NULL OR rc.system_owner_id = v_target_user_id)
     AND NOT EXISTS (SELECT 1 FROM review_tasks rt WHERE rt.review_case_id = rc.id AND rt.is_deleted = false AND rt.status NOT IN ('completed', 'not_applicable'))
     AND EXISTS (SELECT 1 FROM review_tasks rt WHERE rt.review_case_id = rc.id AND rt.is_deleted = false))
    +
    (SELECT COUNT(*) FROM review_cases rc
     WHERE rc.is_deleted = false AND rc.status = 'execution_review'
     AND (v_target_user_id IS NULL OR rc.qa_id = v_target_user_id)
     AND EXISTS (SELECT 1 FROM review_signoffs rs WHERE rs.review_case_id = rc.id AND rs.phase = 'execution_review' AND rs.is_deleted = false)
     AND NOT EXISTS (SELECT 1 FROM review_signoffs rs WHERE rs.review_case_id = rc.id AND rs.phase = 'execution_review' AND rs.is_deleted = false AND rs.status != 'approved'))
    +
    (SELECT COUNT(*) FROM system_profiles sp
     WHERE sp.is_deleted = false AND sp.approval_status = 'in_review'
     AND (v_target_user_id IS NULL OR sp.system_owner_id::UUID = v_target_user_id)
     AND EXISTS (SELECT 1 FROM profile_signoffs ps WHERE ps.system_profile_id = sp.id AND ps.is_deleted = false)
     AND NOT EXISTS (SELECT 1 FROM profile_signoffs ps WHERE ps.system_profile_id = sp.id AND ps.is_deleted = false AND ps.status != 'approved'))
  )::INTEGER INTO v_actions;

  RETURN QUERY SELECT v_tasks, v_signoffs, v_actions, (v_tasks + v_signoffs + v_actions);
END;
$$;