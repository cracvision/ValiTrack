-- Replace absolute unique constraints with partial unique indexes
-- so soft-deleted rows don't block re-insertion of fresh sign-offs

-- profile_signoffs: drop absolute constraint, add partial index
ALTER TABLE profile_signoffs 
  DROP CONSTRAINT IF EXISTS profile_signoffs_system_profile_id_requested_user_id_key;
CREATE UNIQUE INDEX profile_signoffs_active_unique 
  ON profile_signoffs (system_profile_id, requested_user_id) 
  WHERE is_deleted = false;

-- review_signoffs: drop absolute constraint, add partial index
ALTER TABLE review_signoffs 
  DROP CONSTRAINT IF EXISTS review_signoffs_review_case_id_phase_requested_user_id_key;
CREATE UNIQUE INDEX review_signoffs_active_unique 
  ON review_signoffs (review_case_id, phase, requested_user_id) 
  WHERE is_deleted = false;