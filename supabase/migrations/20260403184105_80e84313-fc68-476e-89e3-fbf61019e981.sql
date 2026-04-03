
-- Fix profile_signoffs: Replace the SO/SU reset policy to allow soft-deletes
DROP POLICY IF EXISTS "SO and super_user can reset signoffs on managed profiles" ON profile_signoffs;

CREATE POLICY "SO and super_user can manage signoffs on managed profiles"
ON profile_signoffs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM system_profiles sp
    WHERE sp.id = profile_signoffs.system_profile_id
      AND sp.is_deleted = false
      AND (
        sp.system_owner_id = auth.uid()::text
        OR sp.created_by = auth.uid()
        OR has_role(auth.uid(), 'super_user'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM system_profiles sp
    WHERE sp.id = profile_signoffs.system_profile_id
      AND sp.is_deleted = false
      AND (
        sp.system_owner_id = auth.uid()::text
        OR sp.created_by = auth.uid()
        OR has_role(auth.uid(), 'super_user'::app_role)
      )
  )
);

-- Fix review_signoffs: Add SO/SU policy to allow soft-deletes on managed review cases
CREATE POLICY "SO and super_user can manage signoffs on managed review cases"
ON review_signoffs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM review_cases rc
    WHERE rc.id = review_signoffs.review_case_id
      AND rc.is_deleted = false
      AND (
        rc.system_owner_id = auth.uid()
        OR has_role(auth.uid(), 'super_user'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM review_cases rc
    WHERE rc.id = review_signoffs.review_case_id
      AND rc.is_deleted = false
      AND (
        rc.system_owner_id = auth.uid()
        OR has_role(auth.uid(), 'super_user'::app_role)
      )
  )
);
