ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system';

CREATE OR REPLACE FUNCTION public.validate_theme_preference()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.theme_preference NOT IN ('light', 'dark', 'system') THEN
    RAISE EXCEPTION 'Invalid theme_preference: %. Must be light, dark, or system.', NEW.theme_preference;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_theme_preference
  BEFORE INSERT OR UPDATE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.validate_theme_preference();