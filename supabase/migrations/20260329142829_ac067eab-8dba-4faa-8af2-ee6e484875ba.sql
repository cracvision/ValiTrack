CREATE OR REPLACE FUNCTION public.validate_theme_preference()
RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.theme_preference NOT IN ('light', 'dark', 'system') THEN
    RAISE EXCEPTION 'Invalid theme_preference: %. Must be light, dark, or system.', NEW.theme_preference;
  END IF;
  RETURN NEW;
END;
$$;