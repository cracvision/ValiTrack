
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE VIEW private.admin_user_roles_view AS
SELECT
  au.id AS user_id,
  au.full_name,
  au.username,
  au.email,
  au.is_blocked,
  au.blocked_reason,
  au.account_expires_at,
  au.must_change_password,
  au.created_at AS registered_at,
  ulp.language_code,
  STRING_AGG(ur.role::text, ',' ORDER BY ur.role) AS roles
FROM public.app_users au
LEFT JOIN public.user_language_preference ulp ON ulp.user_id = au.id
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
GROUP BY au.id, au.full_name, au.username, au.email,
         au.is_blocked, au.blocked_reason, au.account_expires_at,
         au.must_change_password, au.created_at, ulp.language_code;

REVOKE ALL ON private.admin_user_roles_view FROM anon, authenticated;
