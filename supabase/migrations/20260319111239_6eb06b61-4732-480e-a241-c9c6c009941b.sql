-- Fix corrupted business_owner_id in existing review case
-- The review case was created using owner_id (system creator) instead of business_owner_id (actual business owner)
UPDATE review_cases 
SET business_owner_id = sp.business_owner_id::uuid
FROM system_profiles sp
WHERE review_cases.system_id = sp.id
  AND review_cases.is_deleted = false
  AND sp.business_owner_id IS NOT NULL
  AND sp.business_owner_id != ''
  AND review_cases.business_owner_id != sp.business_owner_id::uuid;