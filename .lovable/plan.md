

## Restrict Review Case creation to System Owner & Super User

### Impact Assessment
- **RLS**: INSERT policy already enforces this — UI-only change
- **Roles affected**: All 6 roles can still VIEW and navigate to reviews; only SO/SU see create buttons
- **i18n**: No new keys needed — existing `reviews.empty` message works as-is
- **Components**: Only `ReviewCases.tsx` needs changes; `CreateReviewDialog` is unaffected

### Changes — `src/pages/ReviewCases.tsx`

1. Import `useAuth` from `@/hooks/useAuth`
2. Add `const { roles } = useAuth()` and `const canCreate = roles.includes('system_owner') || roles.includes('super_user')`
3. Wrap header "+ New review" button (line 34-37) with `{canCreate && ...}`
4. In empty state (lines 59-68): wrap the create button (lines 63-66) with `{canCreate && ...}` — the icon and message remain visible for all roles

