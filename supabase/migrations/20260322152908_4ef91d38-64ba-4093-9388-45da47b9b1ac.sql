
-- Update review_tasks SELECT policy to allow reassigned users to see ALL tasks in the review case
DROP POLICY IF EXISTS "Users can view tasks for their review cases" ON public.review_tasks;

CREATE POLICY "Users can view tasks for their review cases"
  ON public.review_tasks FOR SELECT TO authenticated
  USING (
    is_deleted = false AND (
      assigned_to = auth.uid()
      OR approved_by_user = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.review_cases rc
        WHERE rc.id = review_tasks.review_case_id
        AND rc.is_deleted = false
        AND (
          rc.system_owner_id = auth.uid()
          OR rc.system_admin_id = auth.uid()
          OR rc.qa_id = auth.uid()
          OR rc.business_owner_id = auth.uid()
          OR rc.it_manager_id = auth.uid()
          OR rc.initiated_by = auth.uid()
          OR has_role(auth.uid(), 'super_user')
        )
      )
      OR public.user_has_assigned_tasks(auth.uid(), review_case_id)
    )
  );
