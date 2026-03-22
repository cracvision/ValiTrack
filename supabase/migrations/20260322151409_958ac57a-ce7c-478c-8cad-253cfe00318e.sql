
-- 1. Update review_cases SELECT policy to include reassigned task users
DROP POLICY IF EXISTS "Users can view assigned review cases" ON public.review_cases;

CREATE POLICY "Users can view assigned review cases"
  ON public.review_cases FOR SELECT TO authenticated
  USING (
    is_deleted = false AND (
      system_owner_id = auth.uid()
      OR system_admin_id = auth.uid()
      OR qa_id = auth.uid()
      OR business_owner_id = auth.uid()
      OR it_manager_id = auth.uid()
      OR initiated_by = auth.uid()
      OR public.has_role(auth.uid(), 'super_user')
      OR EXISTS (
        SELECT 1 FROM public.review_tasks rt
        WHERE rt.review_case_id = review_cases.id
          AND rt.assigned_to = auth.uid()
          AND rt.is_deleted = false
      )
    )
  );

-- 2. Update system_profiles SELECT policy to include users with tasks in review cases for that system
DROP POLICY IF EXISTS "Users can view assigned system profiles" ON public.system_profiles;

CREATE POLICY "Users can view assigned system profiles"
  ON public.system_profiles FOR SELECT TO authenticated
  USING (
    is_deleted = false AND (
      created_by = auth.uid()
      OR system_owner_id = (auth.uid())::text
      OR system_admin_id = (auth.uid())::text
      OR qa_id = (auth.uid())::text
      OR it_manager_id = (auth.uid())::text
      OR business_owner_id = (auth.uid())::text
      OR has_role(auth.uid(), 'super_user')
      OR EXISTS (
        SELECT 1 FROM public.review_tasks rt
        JOIN public.review_cases rc ON rc.id = rt.review_case_id
        WHERE rc.system_id = system_profiles.id
          AND rt.assigned_to = auth.uid()
          AND rt.is_deleted = false
          AND rc.is_deleted = false
      )
    )
  );
