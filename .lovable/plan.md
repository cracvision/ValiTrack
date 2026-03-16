

## Problem

System Profiles data is stored in `localStorage`, which is volatile -- it gets cleared on page refresh if the preview environment resets, and is not shared across sessions or devices. This is why your BePAS-X profile disappeared after refresh.

## Solution: Migrate System Profiles to the Database

Move system profiles from `localStorage` to a persistent database table, with proper RLS policies so authenticated users can manage their data.

### 1. Create `system_profiles` table (SQL migration)

Create a table matching the current `SystemProfile` type with all fields:
- `id` (uuid, PK)
- `name`, `system_identifier`, `description`, `intended_use` (text)
- `system_environment` (text, required)
- `gamp_category` (text, required)  
- `gxp_classification` (text, required)
- `risk_level` (text, required)
- `status` (text, default 'Active')
- `vendor_name`, `vendor_contact`, `vendor_contract_ref` (text)
- `owner_id`, `system_owner_id`, `system_admin_id`, `qa_id`, `it_manager_id` (text)
- `validation_date`, `next_review_date` (date)
- `review_period_months` (integer)
- `created_by` (uuid, references auth.users)
- `created_at`, `updated_at` (timestamptz)
- `updated_at` trigger

RLS policies:
- Authenticated users can SELECT, INSERT, UPDATE, DELETE their own records (`created_by = auth.uid()`)
- Super users can SELECT all records

### 2. Create `useSystemProfiles` hook

Replace `useLocalStorage` with a new hook that:
- Fetches profiles from the database on mount
- Provides `addSystem`, `updateSystem`, `deleteSystem` functions
- Returns loading/error states
- Uses the existing Supabase client

### 3. Update `SystemProfiles.tsx`

- Replace `useLocalStorage<SystemProfile[]>('gxp_systems', [])` with `useSystemProfiles()`
- Add loading skeleton while data loads
- Error handling with toast on failures
- CRUD operations call the hook functions instead of `setSystems`

### 4. Update `Dashboard.tsx`

- Replace `useLocalStorage` with the same `useSystemProfiles()` hook (read-only)
- Add loading state

### 5. Update `SystemProfileForm.tsx`

- `onSubmit` now returns a `SystemProfile` that the parent persists via the hook
- No structural changes to the form itself

### Files to create/modify

- **New migration**: `system_profiles` table + RLS + trigger
- **New file**: `src/hooks/useSystemProfiles.ts`
- **Modified**: `src/pages/SystemProfiles.tsx` -- swap localStorage for DB hook
- **Modified**: `src/pages/Dashboard.tsx` -- swap localStorage for DB hook
- **Remove**: `src/hooks/useLocalStorage.ts` (if no other consumers)

