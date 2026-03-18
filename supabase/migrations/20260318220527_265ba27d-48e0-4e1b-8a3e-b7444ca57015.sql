-- 1. Add business_owner_id column to system_profiles
ALTER TABLE public.system_profiles
  ADD COLUMN IF NOT EXISTS business_owner_id TEXT DEFAULT '';

-- 2. Fix SELECT RLS: drop restrictive policy, create inclusive one
DROP POLICY IF EXISTS "Users can view own system profiles" ON public.system_profiles;

CREATE POLICY "Users can view assigned system profiles"
  ON public.system_profiles FOR SELECT TO authenticated
  USING (
    is_deleted = false AND (
      created_by = auth.uid() OR
      system_owner_id = auth.uid()::text OR
      system_admin_id = auth.uid()::text OR
      qa_id = auth.uid()::text OR
      it_manager_id = auth.uid()::text OR
      business_owner_id = auth.uid()::text OR
      public.has_role(auth.uid(), 'super_user')
    )
  );

-- 3. Fix UPDATE RLS
DROP POLICY IF EXISTS "Users can update own system profiles" ON public.system_profiles;

CREATE POLICY "Users can update assigned system profiles"
  ON public.system_profiles FOR UPDATE TO authenticated
  USING (
    is_deleted = false AND (
      created_by = auth.uid() OR
      system_owner_id = auth.uid()::text OR
      public.has_role(auth.uid(), 'super_user')
    )
  )
  WITH CHECK (
    is_deleted = false AND (
      created_by = auth.uid() OR
      system_owner_id = auth.uid()::text OR
      public.has_role(auth.uid(), 'super_user')
    )
  );

-- 4. Fix task template role assignments
UPDATE public.task_templates SET default_assignee_role = 'business_owner' WHERE code = 'DOC-003';
UPDATE public.task_templates SET default_approver_role = 'system_owner' WHERE code = 'AI-EVAL-009';