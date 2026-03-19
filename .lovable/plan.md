

## Fix: Business Owner visibility for review cases and dashboard

### Root Cause

In `useDashboardSystems.ts`, lines 122-125 apply a **client-side filter** that removes systems where the current user has no role match via `getUserRelationships()`. While this function does check `business_owner_id`, the filtering is redundant with RLS and creates a maintenance risk — any mismatch between the client filter and RLS causes visibility bugs.

`useReviewCases.ts` is already correct — no client-side role filtering.

### Fix

**`src/hooks/useDashboardSystems.ts`** — Remove the client-side authorization filter (lines 122-125). RLS on `system_profiles` already ensures each user only sees systems they're assigned to. Keep `getUserRelationships()` for **display purposes only** (role badges on cards).

Changes:
- Remove the `filtered` variable and `allSystems.filter(...)` logic
- Use `allSystems` directly for the review case lookup and dashboard system mapping
- Keep `getUserRelationships` call only for populating the `userRelationship` display field
- Adjust the `userRelationship` assignment: for super users who are also assigned to a system, show both `'super_user'` and their specific role badges

### Impact
- No database changes
- No RLS changes
- Single file edit: `src/hooks/useDashboardSystems.ts`
- Business Owners (and any future roles) will see all systems RLS grants them access to

