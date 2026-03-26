

## 3D-1: Review Period Date Calculation Fix

Separates the original validation date from the review period anchor so that next_review_date advances correctly after each completed review cycle.

---

### Database Migration

1. Rename `validation_date` → `initial_validation_date` on `system_profiles`
2. Add `last_review_period_end DATE` (nullable) to `system_profiles`
3. No data backfill needed — `last_review_period_end` starts NULL, COALESCE logic produces same results

### Types (`src/types/index.ts`)

- Rename `validation_date` → `initial_validation_date: string`
- Add `last_review_period_end?: string | null`

### Hook Updates

**`useSystemProfiles.ts`** — Update `rowToSystemProfile` mapping, `addSystem` insert, and `updateSystem` update to use `initial_validation_date` and `last_review_period_end`

**`useDashboardSystems.ts`** — Rename `validation_date` → `initial_validation_date` in mapping (line 115). Also update `computeReviewStatus` which checks `system.validation_date` (line 26)

**`useReviewCase.ts`** — Add auto-update of system profile on `approved` transition:
- After setting `completed_at` on the review case, fetch the review case's `period_end_date` and the system profile's `review_period_months`
- Update `system_profiles` SET `last_review_period_end = period_end_date`, recalculate `next_review_date = period_end_date + review_period_months`
- Insert `REVIEW_CYCLE_ADVANCED` audit log entry
- Invalidate `system-profiles` query

**`useReviewCases.ts`** — Update frozen snapshot to use `initial_validation_date` instead of `validation_date`; include `last_review_period_end`

### Form (`SystemProfileForm.tsx`)

- Rename schema field `validation_date` → `initial_validation_date` (line 60)
- Update all form references (~6 places)
- Update `calculateNextReviewDate` to use COALESCE: `anchor = last_review_period_end || initial_validation_date`
- Add read-only "Last Reviewed Through" display field below Initial Validation Date (shows date or "No previous review")
- Label change: "Last Validation Date" → "Initial Validation Date"

### Detail Panel (`SystemProfileDetailDialog.tsx`)

- Rename field reference (line 312)
- Add "Last Reviewed Through" field in Review Schedule section
- Label: use new i18n key

### Review Case Creation (`CreateReviewDialog.tsx`)

- Line 78: change `system.validation_date` → use COALESCE anchor: `system.last_review_period_end || system.initial_validation_date`
- Period start = anchor, period end = next_review_date

### Review Case Detail (`ReviewCaseDetail.tsx`)

- Update frozen snapshot field from `snapshot.validation_date` to `snapshot.initial_validation_date` (line 271)
- Update label key

### i18n Keys (both `en/common.json` and `es/common.json`)

```
systemProfiles.form.initialValidationDate / Fecha de Validación Inicial
systemProfiles.form.initialValidationDateHelp
systemProfiles.form.lastReviewPeriodEnd / Último Período Revisado Hasta
systemProfiles.form.noPreviousReview / Sin revisión previa
systemProfiles.form.lastReviewPeriodEndHelp
systemProfiles.detail.initialValidationDate / Fecha de Validación Inicial
systemProfiles.detail.lastReviewedThrough / Último Período Revisado Hasta
```

### `supabase/types.ts` — Will auto-regenerate after migration

### Files Modified

| File | Change |
|------|--------|
| New migration | Rename column + add column |
| `src/types/index.ts` | Rename field, add field |
| `src/hooks/useSystemProfiles.ts` | Rename in 3 places, add field |
| `src/hooks/useDashboardSystems.ts` | Rename in mapping + computeReviewStatus |
| `src/hooks/useReviewCase.ts` | Auto-update system profile on approval |
| `src/hooks/useReviewCases.ts` | Snapshot field rename |
| `src/components/SystemProfileForm.tsx` | Rename field, COALESCE calc, add read-only display |
| `src/components/SystemProfileDetailDialog.tsx` | Rename + add Last Reviewed Through |
| `src/components/reviews/CreateReviewDialog.tsx` | COALESCE anchor for period dates |
| `src/pages/ReviewCaseDetail.tsx` | Snapshot field rename |
| `src/locales/en/common.json` | New keys |
| `src/locales/es/common.json` | New keys |

### What Does NOT Change

- `review_period_months` calculation matrix
- `completion_window_days`
- E-signatures
- Review workflow states
- Task generation
- RLS policies

---

## DB-OPT-1: Database Query Optimization ✅ COMPLETED

### Problem
Each window focus event triggered 4-7 redundant DB queries via onAuthStateChange('SIGNED_IN') cascade.

### Fix 1: AuthContext profileLoadedRef ✅
- Added `profileLoadedRef` to skip `fetchProfileAndRoles` when profile/roles already loaded
- Reset on SIGNED_OUT only
- Eliminates 3 queries per focus event

### Fix 2: useSystemProfiles → TanStack Query ✅
- Replaced useState/useEffect with useQuery (queryKey: ['system-profiles', user?.id])
- Inherits global staleTime (2min) and refetchOnWindowFocus: false
- Mutations use queryClient.invalidateQueries instead of manual refetch
- Same public interface preserved

### Impact
| Scenario | Before | After |
|----------|--------|-------|
| Window focus | 4-7 queries | 0 |
| Navigation | 1 query | 0 (cache) |
| Login | 4 queries | 4 (unchanged, necessary) |
