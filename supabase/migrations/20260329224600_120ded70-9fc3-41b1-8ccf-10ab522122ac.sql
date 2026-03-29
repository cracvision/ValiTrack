-- Step 1: Drop and recreate the status CHECK constraint to include 'cancelled'
ALTER TABLE public.review_cases DROP CONSTRAINT IF EXISTS review_cases_status_check;

ALTER TABLE public.review_cases ADD CONSTRAINT review_cases_status_check
  CHECK (status IN (
    'draft',
    'plan_review',
    'plan_approval',
    'approved_for_execution',
    'in_progress',
    'execution_review',
    'approved',
    'rejected',
    'cancelled'
  ));

-- Step 2: Drop and recreate the partial unique index to exclude 'cancelled'
DROP INDEX IF EXISTS public.idx_one_active_review_per_system;

CREATE UNIQUE INDEX idx_one_active_review_per_system
  ON public.review_cases (system_id)
  WHERE is_deleted = false
    AND status NOT IN ('approved', 'cancelled');

-- Step 3: Add cancellation metadata columns
ALTER TABLE public.review_cases
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;