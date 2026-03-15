
-- 1. Create app_users table
CREATE TABLE public.app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  username TEXT UNIQUE,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_at TIMESTAMPTZ,
  blocked_reason TEXT,
  account_expires_at TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  first_failed_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.app_users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Super users can view all users" ON public.app_users FOR SELECT USING (has_role(auth.uid(), 'super_user'));
CREATE POLICY "Users can update own profile" ON public.app_users FOR UPDATE USING (auth.uid() = id);

-- 2. Add created_by to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS created_by UUID;

-- 3. Create user_language_preference table
CREATE TABLE public.user_language_preference (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL DEFAULT 'es',
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_language_preference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own language" ON public.user_language_preference FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own language" ON public.user_language_preference FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Super users can view all languages" ON public.user_language_preference FOR SELECT USING (has_role(auth.uid(), 'super_user'));

-- 4. Create password_history table
CREATE TABLE public.password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

-- 5. Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super users can view audit log" ON public.audit_log FOR SELECT USING (has_role(auth.uid(), 'super_user'));

-- 6. Trigger for app_users on new auth user
CREATE OR REPLACE FUNCTION public.handle_new_app_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_users (id, full_name, email, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_app_user
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_app_user();

-- 7. Updated_at trigger for app_users
CREATE TRIGGER update_app_users_updated_at
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Updated_at trigger for user_language_preference
CREATE TRIGGER update_language_pref_updated_at
  BEFORE UPDATE ON public.user_language_preference
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Migrate existing data from profiles to app_users
INSERT INTO public.app_users (id, email, full_name, must_change_password, created_at, updated_at)
SELECT id, email, full_name, must_change_password, created_at, updated_at
FROM public.profiles
ON CONFLICT (id) DO NOTHING;
