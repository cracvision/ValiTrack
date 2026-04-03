

# Fix: Partial Unique Indexes for Soft-Delete Compatibility

## Root Cause
Both `profile_signoffs` and `review_signoffs` have absolute unique constraints that include soft-deleted rows. When `cleanup_profile_signoffs` sets `is_deleted = true` and the code immediately inserts a new sign-off for the same user, the unique constraint blocks it because the old (soft-deleted) row still satisfies the constraint.

Confirmed constraints:
- `profile_signoffs_system_profile_id_requested_user_id_key`: UNIQUE (system_profile_id, requested_user_id)
- `review_signoffs_review_case_id_phase_requested_user_id_key`: UNIQUE (review_case_id, phase, requested_user_id)

## Changes

### 1. Database Migration
Drop the absolute unique constraints and replace with partial unique indexes that only enforce uniqueness on active records:

```sql
-- profile_signoffs
ALTER TABLE profile_signoffs 
  DROP CONSTRAINT profile_signoffs_system_profile_id_requested_user_id_key;
CREATE UNIQUE INDEX profile_signoffs_active_unique 
  ON profile_signoffs (system_profile_id, requested_user_id) 
  WHERE is_deleted = false;

-- review_signoffs
ALTER TABLE review_signoffs 
  DROP CONSTRAINT review_signoffs_review_case_id_phase_requested_user_id_key;
CREATE UNIQUE INDEX review_signoffs_active_unique 
  ON review_signoffs (review_case_id, phase, requested_user_id) 
  WHERE is_deleted = false;
```

### 2. No code changes needed
The sign-off creation code in `useSystemProfiles.ts` already:
- Calls `cleanup_profile_signoffs` RPC (soft-deletes old rows)
- Fetches fresh profile from DB
- Normalizes all role IDs via `normalizeRoleUserId`
- Includes IT Manager in the `signoffRoles` array (line 289)
- Inserts with explicit error handling per role

Once the unique constraint no longer blocks re-insertion of the same user after soft-delete, the existing code will work correctly -- including IT Manager.

### Impact Assessment
- **RLS**: No change -- partial indexes don't affect RLS policies
- **Data integrity**: Uniqueness still enforced for active records; multiple soft-deleted historical records allowed (correct for audit trail)
- **Existing data**: No data migration needed; constraint is relaxed, not tightened
- **Consumers**: `useProfileSignoffs`, `useReviewSignoffs` already filter `is_deleted = false` -- no change needed
- **Audit/compliance**: Preserves full history of soft-deleted sign-offs
- **i18n**: No new strings
- **Types**: No changes

### Files Affected
- `supabase/migrations/<new>.sql` -- single migration

### Validation
After migration:
1. Return profile to Draft, resubmit to In Review -- 4 sign-offs created (SA, QA, BO, IT Manager)
2. Return to Draft again, resubmit -- old sign-offs soft-deleted, 4 fresh ones created
3. Same test for review case plan_review and execution_review phases

