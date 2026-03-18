

## Critical Fix: System Profile RLS + Business Owner Assignment

### Problem Summary

1. **RLS blocks assigned users** — The SELECT policy on `system_profiles` only checks `created_by`, so users assigned as System Owner, QA, etc. cannot see systems they didn't create.
2. **Business Owner field missing** — No `business_owner_id` column on `system_profiles`, no form field, no detail view display.
3. **Two task template role errors** — DOC-003 and AI-EVAL-009 have wrong assignee/approver roles.

---

### Plan

#### Step 1: Single database migration

All schema + policy + data changes in one migration:

```sql
-- 1. Add business_owner_id column
ALTER TABLE public.system_profiles
  ADD COLUMN IF NOT EXISTS business_owner_id TEXT DEFAULT '';

-- 2. Fix SELECT RLS (drop restrictive, create inclusive)
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

-- 4. Fix task template roles
UPDATE public.task_templates SET default_assignee_role = 'business_owner' WHERE code = 'DOC-003';
UPDATE public.task_templates SET default_approver_role = 'system_owner' WHERE code = 'AI-EVAL-009';
```

Note: All role ID columns are `TEXT` type, so `auth.uid()::text` cast is required. The existing super_user SELECT policy is NOT dropped.

#### Step 2: Update `src/types/index.ts`

Add `business_owner_id?: string` to the `SystemProfile` interface (it's already on `ReviewCase` but missing from `SystemProfile`).

#### Step 3: Update `src/components/SystemProfileForm.tsx`

- Add `business_owner_id` to Zod schema (optional string, same as `it_manager_id`)
- Add `'business_owner_id'` to the `RoleSelectFieldProps` name union type
- Add `useRoleUsers('business_owner')` hook call
- Add `business_owner_id` to both default values blocks (create + edit) and the `form.reset` in the edit effect
- Add `RoleSelectField` for Business Owner between QA and IT Manager
- Include `business_owner_id` in the `handleSubmit` SystemProfile object

#### Step 4: Update `src/components/SystemProfileDetailDialog.tsx`

- Add `useRoleUsers('business_owner')` hook
- Include business owner users in the `allUsers` array
- Add Business Owner field in the Role Assignments section

#### Step 5: Update `src/hooks/useDashboardSystems.ts`

- Add `business_owner_id` to the SystemProfile mapping
- Add `business_owner_id` check in `getUserRelationships()`

#### Step 6: i18n — No changes needed

The role labels "Business Owner" / "Responsable del Negocio" already exist in `userForm.roleDescriptions.business_owner`. The system profile form uses hardcoded English labels (same pattern as other fields), so no new i18n keys are required.

---

### What will NOT change

- The super_user SELECT policy stays untouched
- The INSERT policy stays untouched
- `business_owner_id` is optional (same as `it_manager_id`)
- No refactoring or restructuring

