CREATE POLICY "Users can update own language"
  ON public.user_language_preference
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);