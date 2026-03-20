-- SECURITY DEFINER justification: All authenticated users need to see which 
-- users hold each role when creating/editing System Profiles (role assignment 
-- dropdowns). RLS on user_roles correctly restricts direct table access to 
-- own-rows-only. This function provides a controlled, read-only view of 
-- role membership (id, full_name, username only) without exposing sensitive 
-- fields. Follows the same pattern as has_role() and get_user_roles().

CREATE OR REPLACE FUNCTION public.get_users_by_role(p_role app_role)
RETURNS TABLE(id uuid, full_name text, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id, au.full_name, au.username
  FROM public.user_roles ur
  JOIN public.app_users au ON au.id = ur.user_id
  WHERE ur.role = p_role
    AND au.is_blocked = false
    AND (au.account_expires_at IS NULL OR au.account_expires_at > now())
  ORDER BY au.full_name;
$$;

-- Restrict access: only authenticated users can call this function
REVOKE EXECUTE ON FUNCTION public.get_users_by_role(app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_users_by_role(app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_users_by_role(app_role) TO authenticated;