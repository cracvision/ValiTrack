CREATE OR REPLACE FUNCTION public.soft_delete_system_profile(
  p_system_profile_id UUID,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is creator or super_user
  IF NOT (
    EXISTS (SELECT 1 FROM system_profiles WHERE id = p_system_profile_id AND created_by = auth.uid())
    OR has_role(auth.uid(), 'super_user'::app_role)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Verify no active review case exists for this system
  IF EXISTS (
    SELECT 1 FROM review_cases
    WHERE system_id = p_system_profile_id
    AND is_deleted = false
    AND status NOT IN ('approved', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'Cannot delete system profile with active review case';
  END IF;

  -- Soft delete
  UPDATE system_profiles
  SET is_deleted = true,
      deleted_at = now(),
      deleted_by = auth.uid(),
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_system_profile_id
    AND is_deleted = false;

  -- Audit log
  INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'SYSTEM_PROFILE_DELETED', 'system_profile', p_system_profile_id,
          jsonb_build_object('reason', p_reason));
END;
$$;