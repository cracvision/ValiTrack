

## Duplicate Review Case Prevention

### Problem
Users can create multiple review cases for the same system simultaneously — compliance gap. Only ONE active (non-approved) review case should exist per system.

### Plan

#### 1. Database migration — Partial unique index
Create migration with:
```sql
CREATE UNIQUE INDEX idx_one_active_review_per_system 
ON public.review_cases (system_id) 
WHERE is_deleted = false AND status != 'approved';
```
This is the belt-and-suspenders safety net for race conditions.

#### 2. Frontend guard — CreateReviewDialog
In `src/components/reviews/CreateReviewDialog.tsx`:

- Add a query to fetch active (non-approved, non-deleted) review cases for available systems
- Filter the system dropdown to exclude systems that already have an active review case
- If a system somehow gets selected with an active case, show inline error with the existing case's status and disable "Next"

#### 3. Backend error handling — useCreateReviewCase
In `src/hooks/useReviewCases.ts`:

- In the `mutationFn`, before inserting, query `review_cases` for the selected `system_id` where `is_deleted = false AND status != 'approved'`
- If found, throw with a user-friendly message
- Additionally, catch Postgres error code `23505` (unique_violation) from the insert and surface the duplicate error message

#### 4. i18n keys
Add `reviews.createGuard.activeExists` and `reviews.createGuard.duplicateError` to both `en/common.json` and `es/common.json` under the `reviews` namespace.

### Files modified
| File | Change |
|---|---|
| New migration | Partial unique index on `review_cases(system_id)` |
| `src/components/reviews/CreateReviewDialog.tsx` | Filter dropdown by active cases; inline error if active case exists |
| `src/hooks/useReviewCases.ts` | Pre-insert check + catch `23505` error |
| `src/locales/en/common.json` | Add `reviews.createGuard` keys |
| `src/locales/es/common.json` | Add `reviews.createGuard` keys |

### Impact evaluation
- **RLS**: Read query on `review_cases` uses existing SELECT policy — all roles with case visibility can see active cases. The creation flow already requires `system_owner` or `super_user` role.
- **Components**: No other components affected — change is scoped to creation flow only.
- **Audit/compliance**: No audit trail changes needed — this is a prevention guard, not a state change.
- **i18n**: Both EN and ES translations included.
- **Types**: No TypeScript type changes needed.
- **Soft deletes**: All queries include `is_deleted = false`. Index WHERE clause also includes it.
- **Rejected status**: Treated as non-terminal — blocks creation like all other active statuses.

