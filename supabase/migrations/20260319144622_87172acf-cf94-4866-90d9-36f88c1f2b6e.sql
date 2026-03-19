
-- Step 1: Drop existing CHECK constraint on status
ALTER TABLE public.review_cases DROP CONSTRAINT IF EXISTS review_cases_status_check;

-- Step 2: Add new CHECK constraint with all 8 states
ALTER TABLE public.review_cases ADD CONSTRAINT review_cases_status_check
  CHECK (status IN (
    'draft',
    'plan_review',
    'plan_approval',
    'approved_for_execution',
    'in_progress',
    'execution_review',
    'approved',
    'rejected'
  ));
