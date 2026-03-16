
CREATE OR REPLACE FUNCTION public.get_admin_users_list()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  username text,
  email text,
  roles text,
  language_code text,
  account_expires_at timestamptz,
  is_blocked boolean,
  blocked_reason text,
  must_change_password boolean,
  registered_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    u.id AS user_id,
    u.full_name,
    u.username,
    u.email,
    COALESCE(string_agg(r.role::text, ',' ORDER BY r.role::text), '') AS roles,
    l.language_code,
    u.account_expires_at,
    u.is_blocked,
    u.blocked_reason,
    u.must_change_password,
    u.created_at AS registered_at
  FROM public.app_users u
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  LEFT JOIN public.user_language_preference l ON l.user_id = u.id
  GROUP BY u.id, u.full_name, u.username, u.email, l.language_code,
           u.account_expires_at, u.is_blocked, u.blocked_reason,
           u.must_change_password, u.created_at
  ORDER BY u.created_at DESC;
$$;
