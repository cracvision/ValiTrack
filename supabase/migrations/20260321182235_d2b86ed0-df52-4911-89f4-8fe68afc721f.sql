-- Allow SO to update tasks (needed for task execution transitions)
DROP POLICY IF EXISTS "Assigned users can update their tasks" ON public.review_tasks;
CREATE POLICY "Assigned users and SO can update tasks"
  ON public.review_tasks FOR UPDATE TO authenticated
  USING (
    is_deleted = false AND (
      assigned_to = auth.uid() OR
      has_role(auth.uid(), 'super_user') OR
      EXISTS (
        SELECT 1 FROM public.review_cases rc
        WHERE rc.id = review_tasks.review_case_id
        AND rc.is_deleted = false
        AND rc.system_owner_id = auth.uid()
      )
    )
  );