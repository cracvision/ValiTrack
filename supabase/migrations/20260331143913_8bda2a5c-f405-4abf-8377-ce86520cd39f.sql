
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

  SELECT
    'task'::TEXT,
    rt.id,
    rt.assigned_to,
    au.full_name,
    rt.review_case_id,
    rc.system_id,
    sp.name,
    sp.system_identifier,
    rc.status,
    rt.title,
    rt.title_es,
    rt.task_group::TEXT,
    rt.task_group::TEXT,
    rt.status,
    rt.due_date::TIMESTAMPTZ,
    rt.created_at,
    CASE
      WHEN rt.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rt.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT,
    NULL::TEXT,
    jsonb_build_object('execution_phase', rt.execution_phase, 'task_group', rt.task_group, 'execution_type', rt.execution_type)
  FROM review_tasks rt
  JOIN review_cases rc ON rc.id = rt.review_case_id AND rc.is_deleted = false
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rt.assigned_to
  WHERE rt.is_deleted = false
    AND rt.status IN ('pending', 'in_progress')
    AND (v_target_user_id IS NULL OR rt.assigned_to = v_target_user_id)

  UNION ALL

  SELECT
    'review_signoff'::TEXT,
    rs.id,
    rs.requested_user_id,
    au.full_name,
    rs.review_case_id,
    rc.system_id,
    sp.name,
    sp.system_identifier,
    rc.status,
    CASE rs.phase WHEN 'plan_review' THEN 'Plan Review Sign-off' WHEN 'execution_review' THEN 'Execution Review Sign-off' END::TEXT,
    CASE rs.phase WHEN 'plan_review' THEN 'Firma de Revisión del Plan' WHEN 'execution_review' THEN 'Firma de Revisión de Ejecución' END::TEXT,
    rs.requested_role,
    rs.requested_role,
    rs.status,
    rc.due_date::TIMESTAMPTZ,
    rs.created_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT,
    NULL::TEXT,
    jsonb_build_object('phase', rs.phase, 'requested_role', rs.requested_role)
  FROM review_signoffs rs
  JOIN review_cases rc ON rc.id = rs.review_case_id AND rc.is_deleted = false
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rs.requested_user_id
  WHERE rs.is_deleted = false
    AND rs.status = 'pending'
    AND (v_target_user_id IS NULL OR rs.requested_user_id = v_target_user_id)

  UNION ALL

  SELECT
    'profile_signoff'::TEXT,
    ps.id,
    ps.requested_user_id,
    au.full_name,
    NULL::UUID,
    ps.system_profile_id,
    sp.name,
    sp.system_identifier,
    sp.status,
    'System Profile Sign-off'::TEXT,
    'Firma de Perfil de Sistema'::TEXT,
    ps.requested_role,
    ps.requested_role,
    ps.status,
    NULL::TIMESTAMPTZ,
    ps.created_at,
    'upcoming'::TEXT,
    NULL::TEXT,
    jsonb_build_object('requested_role', ps.requested_role, 'profile_status', sp.status)
  FROM profile_signoffs ps
  JOIN system_profiles sp ON sp.id = ps.system_profile_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = ps.requested_user_id
  WHERE ps.is_deleted = false
    AND ps.status = 'pending'
    AND sp.status = 'in_review'
    AND (v_target_user_id IS NULL OR ps.requested_user_id = v_target_user_id)

  UNION ALL

  SELECT
    'action'::TEXT,
    rc.id,
    rc.system_owner_id,
    au.full_name,
    rc.id,
    rc.system_id,
    sp.name,
    sp.system_identifier,
    rc.status,
    'Advance to Plan Approval'::TEXT,
    'Avanzar a Aprobación del Plan'::TEXT,
    'All sign-offs complete'::TEXT,
    'Todas las firmas completadas'::TEXT,
    rc.status,
    rc.due_date::TIMESTAMPTZ,
    rc.updated_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT,
    'advance_to_plan_approval'::TEXT,
    jsonb_build_object('transition_from', 'plan_review', 'transition_to', 'plan_approval')
  FROM review_cases rc
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rc.system_owner_id
  WHERE rc.is_deleted = false
    AND rc.status = 'plan_review'
    AND (v_target_user_id IS NULL OR rc.system_owner_id = v_target_user_id)
    AND EXISTS (SELECT 1 FROM review_signoffs rs2 WHERE rs2.review_case_id = rc.id AND rs2.phase = 'plan_review' AND rs2.is_deleted = false)
    AND NOT EXISTS (SELECT 1 FROM review_signoffs rs2 WHERE rs2.review_case_id = rc.id AND rs2.phase = 'plan_review' AND rs2.is_deleted = false AND rs2.status != 'approved')

  UNION ALL

  SELECT
    'action'::TEXT,
    rc.id,
    rc.qa_id,
    au.full_name,
    rc.id,
    rc.system_id,
    sp.name,
    sp.system_identifier,
    rc.status,
    'Approve Plan (E-Signature)'::TEXT,
    'Aprobar Plan (Firma Electrónica)'::TEXT,
    'E-signature required'::TEXT,
    'Se requiere firma electrónica'::TEXT,
    rc.status,
    rc.due_date::TIMESTAMPTZ,
    rc.updated_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT,
    'approve_plan_esig'::TEXT,
    jsonb_build_object('transition_from', 'plan_approval', 'transition_to', 'approved_for_execution', 'requires_esig', true)
  FROM review_cases rc
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rc.qa_id
  WHERE rc.is_deleted = false
    AND rc.status = 'plan_approval'
    AND (v_target_user_id IS NULL OR rc.qa_id = v_target_user_id)

  UNION ALL

  SELECT
    'action'::TEXT,
    rc.id,
    rc.system_owner_id,
    au.full_name,
    rc.id,
    rc.system_id,
    sp.name,
    sp.system_identifier,
    rc.status,
    'Start Task Execution'::TEXT,
    'Iniciar Ejecución de Tareas'::TEXT,
    'Tasks generated, ready to begin'::TEXT,
    'Tareas generadas, listo para comenzar'::TEXT,
    rc.status,
    rc.due_date::TIMESTAMPTZ,
    rc.updated_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT,
    'start_execution'::TEXT,
    jsonb_build_object('transition_from', 'approved_for_execution', 'transition_to', 'in_progress')
  FROM review_cases rc
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rc.system_owner_id
  WHERE rc.is_deleted = false
    AND rc.status = 'approved_for_execution'
    AND (v_target_user_id IS NULL OR rc.system_owner_id = v_target_user_id)

  UNION ALL

  SELECT
    'action'::TEXT,
    rc.id,
    rc.system_owner_id,
    au.full_name,
    rc.id,
    rc.system_id,
    sp.name,
    sp.system_identifier,
    rc.status,
    'Submit for Final Review'::TEXT,
    'Enviar a Revisión Final'::TEXT,
    'All tasks resolved'::TEXT,
    'Todas las tareas resueltas'::TEXT,
    rc.status,
    rc.due_date::TIMESTAMPTZ,
    rc.updated_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT,
    'submit_for_final_review'::TEXT,
    jsonb_build_object('transition_from', 'in_progress', 'transition_to', 'execution_review')
  FROM review_cases rc
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rc.system_owner_id
  WHERE rc.is_deleted = false
    AND rc.status = 'in_progress'
    AND (v_target_user_id IS NULL OR rc.system_owner_id = v_target_user_id)
    AND NOT EXISTS (SELECT 1 FROM review_tasks rt2 WHERE rt2.review_case_id = rc.id AND rt2.is_deleted = false AND rt2.status NOT IN ('completed', 'not_applicable'))
    AND EXISTS (SELECT 1 FROM review_tasks rt2 WHERE rt2.review_case_id = rc.id AND rt2.is_deleted = false)

  UNION ALL

  SELECT
    'action'::TEXT,
    rc.id,
    rc.qa_id,
    au.full_name,
    rc.id,
    rc.system_id,
    sp.name,
    sp.system_identifier,
    rc.status,
    'Final Approval (E-Signature)'::TEXT,
    'Aprobación Final (Firma Electrónica)'::TEXT,
    'E-signature required to approve or reject'::TEXT,
    'Se requiere firma electrónica para aprobar o rechazar'::TEXT,
    rc.status,
    rc.due_date::TIMESTAMPTZ,
    rc.updated_at,
    CASE
      WHEN rc.due_date IS NOT NULL AND rc.due_date < CURRENT_DATE THEN 'overdue'
      WHEN rc.due_date IS NOT NULL AND rc.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
      ELSE 'upcoming'
    END::TEXT,
    'final_approval_esig'::TEXT,
    jsonb_build_object('transition_from', 'execution_review', 'transition_to', 'approved_or_rejected', 'requires_esig', true)
  FROM review_cases rc
  JOIN system_profiles sp ON sp.id = rc.system_id AND sp.is_deleted = false
  LEFT JOIN app_users au ON au.id = rc.qa_id
  WHERE rc.is_deleted = false
    AND rc.status = 'execution_review'
    AND (v_target_user_id IS NULL OR rc.qa_id = v_target_user_id)
    AND EXISTS (SELECT 1 FROM review_signoffs rs2 WHERE rs2.review_case_id = rc.id AND rs2.phase = 'execution_review' AND rs2.is_deleted = false)
    AND NOT EXISTS (SELECT 1 FROM review_signoffs rs2 WHERE rs2.review_case_id = rc.id AND rs2.phase = 'execution_review' AND rs2.is_deleted = false AND rs2.status != 'approved')

  UNION ALL

  SELECT
    'action'::TEXT,
    sp.id,
    sp.system_owner_id::UUID,
    au.full_name,
    NULL::UUID,
    sp.id,
    sp.name,
    sp.system_identifier,
    sp.status,
    'Approve System Profile'::TEXT,
    'Aprobar Perfil de Sistema'::TEXT,
    'All sign-offs complete'::TEXT,
    'Todas las firmas completadas'::TEXT,
    sp.status,
    NULL::TIMESTAMPTZ,
    sp.updated_at,
    'upcoming'::TEXT,
    'approve_profile'::TEXT,
    jsonb_build_object('transition_from', 'in_review', 'transition_to', 'approved')
  FROM system_profiles sp
  LEFT JOIN app_users au ON au.id = sp.system_owner_id::UUID
  WHERE sp.is_deleted = false
    AND sp.status = 'in_review'
    AND (v_target_user_id IS NULL OR sp.system_owner_id::UUID = v_target_user_id)
    AND EXISTS (SELECT 1 FROM profile_signoffs ps2 WHERE ps2.system_profile_id = sp.id AND ps2.is_deleted = false)
    AND NOT EXISTS (SELECT 1 FROM profile_signoffs ps2 WHERE ps2.system_profile_id = sp.id AND ps2.is_deleted = false AND ps2.status != 'approved')

  ORDER BY 17 ASC, 15 ASC NULLS LAST, 16 ASC;
END;
$$;
