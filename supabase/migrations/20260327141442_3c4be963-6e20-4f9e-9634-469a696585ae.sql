
DROP POLICY "Assigned users can update review cases" ON public.review_cases;

CREATE POLICY "Assigned users can update review cases"
ON public.review_cases
FOR UPDATE
TO authenticated
USING (
  (is_deleted = false) AND (
    (system_owner_id = auth.uid()) OR
    (qa_id = auth.uid()) OR
    has_role(auth.uid(), 'super_user'::app_role)
  )
)
WITH CHECK (
  (system_owner_id = auth.uid()) OR
  (qa_id = auth.uid()) OR
  has_role(auth.uid(), 'super_user'::app_role)
);
