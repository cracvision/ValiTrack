
CREATE OR REPLACE FUNCTION public.soft_delete_review_case(p_review_case_id uuid, p_reason text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_is_deleted boolean;
  v_system_owner_id uuid;
  v_system_name text;
  v_system_id uuid;
  v_review_period_start date;
  v_review_period_end date;
  v_review_level text;
  v_initiated_by uuid;
  v_initiator_name text;
  v_deleter_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'forbidden';
  END IF;

  SELECT status, is_deleted, system_owner_id, system_id,
         review_period_start, review_period_end, review_level, initiated_by,
         (frozen_system_snapshot->>'name')::text
  INTO v_status, v_is_deleted, v_system_owner_id, v_system_id,
       v_review_period_start, v_review_period_end, v_review_level, v_initiated_by,
       v_system_name
  FROM public.review_cases
  WHERE id = p_review_case_id;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF v_is_deleted THEN
    RETURN 'already_deleted';
  END IF;

  IF v_status <> 'draft' THEN
    RETURN 'not_draft';
  END IF;

  IF v_uid <> v_system_owner_id AND NOT has_role(v_uid, 'super_user'::app_role) THEN
    RETURN 'forbidden';
  END IF;

  -- Resolve names for audit
  SELECT full_name INTO v_initiator_name FROM public.app_users WHERE id = v_initiated_by;
  SELECT full_name INTO v_deleter_name FROM public.app_users WHERE id = v_uid;

  -- Soft-delete
  UPDATE public.review_cases
  SET is_deleted = true,
      deleted_at = now(),
      deleted_by = v_uid,
      updated_at = now(),
      updated_by = v_uid
  WHERE id = p_review_case_id;

  -- Audit log
  INSERT INTO public.audit_log (action, resource_type, resource_id, user_id, details)
  VALUES (
    'REVIEW_CASE_DELETED',
    'review_case',
    p_review_case_id,
    v_uid,
    jsonb_build_object(
      'system_name', v_system_name,
      'system_id', v_system_id,
      'review_period', v_review_period_start || ' — ' || v_review_period_end,
      'review_level', v_review_level,
      'reason', COALESCE(p_reason, ''),
      'initiated_by', COALESCE(v_initiator_name, v_initiated_by::text),
      'deleted_by', COALESCE(v_deleter_name, v_uid::text)
    )
  );

  RETURN 'deleted';
END;
$$;
