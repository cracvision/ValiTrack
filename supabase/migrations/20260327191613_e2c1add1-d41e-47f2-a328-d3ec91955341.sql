CREATE UNIQUE INDEX idx_unique_system_identifier
ON public.system_profiles (LOWER(system_identifier))
WHERE is_deleted = false;