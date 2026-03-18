CREATE OR REPLACE FUNCTION public.resolve_user_names(user_ids UUID[])
RETURNS TABLE(id UUID, full_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.id, au.full_name
  FROM public.app_users au
  WHERE au.id = ANY(user_ids)
$$;