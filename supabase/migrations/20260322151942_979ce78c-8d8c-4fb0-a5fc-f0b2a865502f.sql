
-- Step 1: Create SECURITY DEFINER helper to break RLS cycle
CREATE OR REPLACE FUNCTION public.user_has_assigned_tasks(
  _user_id UUID,
  _review_case_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.review_tasks
    WHERE review_case_id = _review_case_id
    AND assigned_to = _user_id
    AND is_deleted = false
  );
$$;

COMMENT ON FUNCTION public.user_has_assigned_tasks IS 
  'SECURITY DEFINER: Bypasses RLS to check task assignments. Required to break circular RLS dependency between review_cases and review_tasks.';

-- Step 2: Fix review_cases SELECT policy using the function instead of direct EXISTS
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
      OR public.user_has_assigned_tasks(auth.uid(), id)
    )
  );

-- Step 3: Fix system_profiles SELECT policy using function through review_cases
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
        SELECT 1 FROM public.review_cases rc
        WHERE rc.system_id = system_profiles.id
          AND rc.is_deleted = false
          AND public.user_has_assigned_tasks(auth.uid(), rc.id)
      )
    )
  );
