-- Allow System Owners and Super Users to reset signoffs on profiles they manage
-- This is required for the approval workflow: when an SO resubmits a profile
-- for review, they need to reset ALL signoff records to 'pending', including
-- records belonging to other users (SA, QA, BO, IT Manager).
CREATE POLICY "SO and super_user can reset signoffs on managed profiles"
  ON public.profile_signoffs FOR UPDATE TO authenticated
  USING (
    is_deleted = false AND (
      EXISTS (
        SELECT 1 FROM public.system_profiles sp
        WHERE sp.id = profile_signoffs.system_profile_id
        AND sp.is_deleted = false
        AND (
          sp.system_owner_id = auth.uid()::text OR
          sp.created_by = auth.uid() OR
          public.has_role(auth.uid(), 'super_user')
        )
      )
    )
  )
  WITH CHECK (
    is_deleted = false AND (
      EXISTS (
        SELECT 1 FROM public.system_profiles sp
        WHERE sp.id = profile_signoffs.system_profile_id
        AND sp.is_deleted = false
        AND (
          sp.system_owner_id = auth.uid()::text OR
          sp.created_by = auth.uid() OR
          public.has_role(auth.uid(), 'super_user')
        )
      )
    )
  );