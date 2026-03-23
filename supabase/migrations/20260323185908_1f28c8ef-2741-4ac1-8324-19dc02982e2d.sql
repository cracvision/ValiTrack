
-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Super users can update checkoffs" ON public.task_instruction_checkoffs;
DROP POLICY IF EXISTS "Users can uncheck steps on active tasks" ON public.task_instruction_checkoffs;
DROP POLICY IF EXISTS "Users can uncheck steps on their assigned tasks" ON public.task_instruction_checkoffs;
DROP POLICY IF EXISTS "Users can uncheck steps based on task status" ON public.task_instruction_checkoffs;

-- New policy: in_progress → assignee/SO/super_user; completed → SO/super_user only
CREATE POLICY "Users can uncheck steps based on task status"
  ON public.task_instruction_checkoffs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.review_tasks rt
      JOIN public.review_cases rc ON rc.id = rt.review_case_id
      WHERE rt.id = task_instruction_checkoffs.task_id
      AND rt.is_deleted = false
      AND (
        (rt.status = 'in_progress' AND (
          rt.assigned_to = auth.uid() OR
          rc.system_owner_id = auth.uid() OR
          public.has_role(auth.uid(), 'super_user')
        ))
        OR
        (rt.status = 'completed' AND (
          rc.system_owner_id = auth.uid() OR
          public.has_role(auth.uid(), 'super_user')
        ))
      )
    )
  );
