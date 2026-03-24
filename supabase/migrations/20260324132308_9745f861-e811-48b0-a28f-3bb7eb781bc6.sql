ALTER TABLE public.system_profiles
  ADD COLUMN completion_window_days INTEGER NOT NULL DEFAULT 90;

COMMENT ON COLUMN public.system_profiles.completion_window_days IS
  'Number of days after the review period ends to complete the periodic review. Default 90 days per industry practice.';

ALTER TABLE public.review_cases
  ADD COLUMN period_end_date DATE;

COMMENT ON COLUMN public.review_cases.period_end_date IS
  'End date of the review period being evaluated. The due_date = period_end_date + completion_window_days.';