CREATE POLICY "super_user_insert_ai_task_results"
  ON public.ai_task_results FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_user'::app_role));