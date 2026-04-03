

# Global Audit: Clean Slate Pattern for Stale Sign-offs and Task Assignments

## Audit Results

### 1. System Profile sign-offs (profile_signoffs) — ✅ Already fixed
Soft-delete before insert on `in_review` transition. Return to `draft` also soft-deletes. No action needed.

### 2. Review Case plan_review sign-offs — ❌ Bug exists
**Current behavior:** Lines 171-202 of `useReviewCase.ts` reset existing signoffs to `pending` and use `upsert` with `ignoreDuplicates`. If SA or QA changed on the system profile while the case was in `draft` or `rejected`, the old user's signoff persists, and the new user may not get one (if `ignoreDuplicates` skips the insert).

**Expected behavior:** Soft-delete all existing active signoffs for this phase, then insert fresh records for the current SA and QA from the review case.

**Fix needed:** Yes — replace the reset+upsert with soft-delete+insert pattern.

### 3. Review Case execution_review sign-offs — ❌ Same bug
The same code block at line 162 handles both `plan_review` and `execution_review` transitions identically. Same reset+upsert pattern applies. If QA returned the case to `in_progress` (from `execution_review`), SO made changes, and resubmitted to `execution_review`, old signoffs persist.

**Fix needed:** Yes — same fix as #2 (both phases handled in the same `if` block).

### 4. Sign-offs after objections — ❌ Same bug
When SO receives objections during `plan_review`, the SO can return to `draft` (or QA can return to `plan_review` from `plan_approval`). On resubmission, the same reset+upsert code runs. Objected signoffs get reset to `pending` for the OLD users, not recreated for the CURRENT users.

**Fix needed:** Yes — covered by the same fix as #2/#3.

### 5. Task assignments after role changes — ⚠️ Partially covered, edge case exists
**Current behavior:** Task generation (line 226-293) has an idempotency guard: `if (existingTaskCount === 0)`. This means if tasks already exist from a previous `approved_for_execution` cycle, they will NOT be regenerated with new role assignments.

**Scenario:** Review case reaches `approved_for_execution` → tasks generated → case is rejected → goes back to `draft` → SO changes roles on system profile → case re-progresses to `approved_for_execution` → **old tasks with old assignees remain, no new tasks generated**.

**However**, the review case's `frozen_system_snapshot` and role IDs (`system_admin_id`, `qa_id`, etc.) are set at creation time and are immutable. The workflow currently does NOT update these when resubmitting from `rejected → draft → plan_review`. The role assignments on the review case itself don't change — only the system profile's roles change.

**This is a design decision, not a bug in the current architecture.** The `frozen_system_snapshot` pattern intentionally freezes roles at review creation time. If the user wants updated roles, they would need to delete the draft and create a new review case.

**Fix needed:** No — this is by design. The frozen snapshot preserves the audit trail. Documenting this as a known limitation. If role changes mid-review are needed, task reassignment (which already exists) is the correct mechanism.

### 6. Intray items — ✅ Already correct
Both `get_user_intray_items` and `get_user_intray_count` filter `rs.is_deleted = false` and `ps.is_deleted = false` in all sections. Soft-deleted signoffs will be automatically excluded. No fix needed.

### 7. Notification recipients — ✅ Already correct
The notification wiring in `useReviewCase.ts` (lines 207-221) sends `notifySignoffRequested` to `signoffUserIds`, which is built from the newly inserted signoffs. After the fix, since we soft-delete old records first and only insert fresh ones, only the current assignees will be in `signoffUserIds`. No fix needed.

---

## Changes Required

### File: `src/hooks/useReviewCase.ts`

**Lines 161-222 — Replace the sign-off creation block:**

Replace the current pattern:
1. ~~`update` existing signoffs to `pending`~~ → **Soft-delete** all existing active signoffs for this phase (`is_deleted = true`, `deleted_at`, `deleted_by`)
2. ~~`upsert` with `ignoreDuplicates`~~ → **Insert** fresh signoff records

Specifically:
- Replace lines 171-181 (the `update` that resets to `pending`) with a soft-delete update: `is_deleted: true, deleted_at: now, deleted_by: user.id, updated_by: user.id` filtered by `review_case_id`, `phase`, and `is_deleted = false`
- Replace lines 192-202 (the `upsert` with `ignoreDuplicates`) with a simple `insert` (no upsert needed since old records are now soft-deleted)

No other files need changes. No database migration required — `review_signoffs` already has `is_deleted`, `deleted_at`, `deleted_by` columns.

## Impact Assessment

- **RLS:** No impact — existing UPDATE policies allow SO/SU to manage signoffs via the "System can insert signoffs" and update policies
- **Intray/RPCs:** Already filter `is_deleted = false` — will automatically reflect changes
- **Notifications:** Already scoped to newly inserted signoffs — no stale recipients
- **Audit trail:** Soft-delete preserves all historical sign-off records
- **i18n:** No new user-facing strings
- **Types:** No changes needed

