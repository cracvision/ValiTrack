
-- SECURITY DEFINER RPC #9: cleanup_profile_signoffs
-- Soft-deletes all active profile_signoffs for a given system profile.
-- Validates caller is system_owner or super_user.
CREATE OR REPLACE FUNCTION public.cleanup_profile_signoffs(p_system_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_authorized BOOLEAN;
  v_affected INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate caller is system_owner of this profile, creator, or super_user
  SELECT EXISTS(
    SELECT 1 FROM system_profiles sp
    WHERE sp.id = p_system_profile_id
      AND sp.is_deleted = false
      AND (
        sp.system_owner_id = v_uid::text
        OR sp.created_by = v_uid
        OR has_role(v_uid, 'super_user'::app_role)
      )
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied: not authorized to manage sign-offs for this profile';
  END IF;

  -- Soft-delete all active signoffs for this profile
  UPDATE profile_signoffs
  SET is_deleted = true,
      deleted_at = now(),
      deleted_by = v_uid,
      updated_by = v_uid,
      updated_at = now()
  WHERE system_profile_id = p_system_profile_id
    AND is_deleted = false;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;

-- SECURITY DEFINER RPC #10: cleanup_review_signoffs
-- Soft-deletes all active review_signoffs for a given review case and phase.
-- Validates caller is system_owner of the review case or super_user.
CREATE OR REPLACE FUNCTION public.cleanup_review_signoffs(p_review_case_id UUID, p_phase TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_authorized BOOLEAN;
  v_affected INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate caller is system_owner of this review case or super_user
  SELECT EXISTS(
    SELECT 1 FROM review_cases rc
    WHERE rc.id = p_review_case_id
      AND rc.is_deleted = false
      AND (
        rc.system_owner_id = v_uid
        OR has_role(v_uid, 'super_user'::app_role)
      )
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied: not authorized to manage sign-offs for this review case';
  END IF;

  -- Soft-delete all active signoffs for this case and phase
  UPDATE review_signoffs
  SET is_deleted = true,
      deleted_at = now(),
      deleted_by = v_uid,
      updated_by = v_uid,
      updated_at = now()
  WHERE review_case_id = p_review_case_id
    AND phase = p_phase
    AND is_deleted = false;

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;
