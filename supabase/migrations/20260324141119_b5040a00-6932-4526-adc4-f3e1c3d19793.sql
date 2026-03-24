-- Rename validation_date to initial_validation_date
ALTER TABLE public.system_profiles
  RENAME COLUMN validation_date TO initial_validation_date;

COMMENT ON COLUMN public.system_profiles.initial_validation_date IS
  'Original validation date (IQ/OQ/PQ completion). Historical record — never changes.';

-- Add last_review_period_end column
ALTER TABLE public.system_profiles
  ADD COLUMN last_review_period_end DATE;

COMMENT ON COLUMN public.system_profiles.last_review_period_end IS
  'End date of the last completed periodic review period. NULL for systems never reviewed. When NULL, next_review_date calculated from initial_validation_date.';