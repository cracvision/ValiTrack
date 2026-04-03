
Goal: make System Profile sign-off cleanup actually work, and remove the same failure mode from Review Case sign-offs.

What I verified:
- In `src/hooks/useSystemProfiles.ts`, the cleanup is already attempted in both places:
  1. before inserting new `profile_signoffs` on `draft -> in_review`
  2. on `in_review -> draft`
- But the cleanup is failing in practice because:
  - the `profile_signoffs` RLS update policy requires `is_deleted = false` in `WITH CHECK`, so an update that sets `is_deleted = true` is rejected
  - the hook does not check the returned `error` from that update, so the flow continues and inserts new sign-offs anyway
- I also verified the same hidden failure pattern still exists for `review_signoffs`:
  - `useReviewCase.ts` attempts soft-delete
  - but there is no SO/SU reset policy for `review_signoffs`
  - and that hook also ignores Supabase errors for cleanup/inserts

Implementation plan:

1. Database/RLS fix via migration
- Replace the current `profile_signoffs` SO/SU update policy with one that allows soft-delete updates on managed profiles.
- Add an equivalent SO/SU update policy for `review_signoffs` so the owner/super user can soft-delete stale phase sign-offs on managed review cases.
- Keep reviewer self-update policies intact, so reviewers can still only act on their own active sign-offs.
- No schema change needed; this is a policy correction.

2. Harden `useSystemProfiles.ts`
- In `transitionApprovalStatus`, capture and validate the result of:
  - soft-delete before `in_review`
  - insert of each fresh `profile_signoff`
  - soft-delete on `return to draft`
- If cleanup fails, stop the transition flow and surface an error toast instead of continuing.
- If any insert fails, stop and surface the error.
- Keep the order as:
  1. cleanup stale sign-offs
  2. insert fresh sign-offs for current SA/QA/BO/IT Manager
  3. trigger notifications only for successfully created fresh sign-offs

3. Harden `useReviewCase.ts`
- Apply the same explicit error handling to review sign-off cleanup/inserts for:
  - `plan_review`
  - `execution_review`
- This prevents the same stale-signoff bug from remaining hidden there.

4. Behavior to guarantee after fix
- System Profile `draft -> in_review`:
  - all active old `profile_signoffs` for that profile are soft-deleted first
  - only current role assignees get fresh active sign-offs
- System Profile `in_review -> draft`:
  - all active sign-offs for that profile are soft-deleted immediately
- Old objections from removed reviewers no longer appear in the active banner/state because all reads already filter `is_deleted = false`.

Impact evaluation:
- RLS / role visibility:
  - needed change: allow SO/SU cleanup updates on managed sign-offs
  - select visibility stays unchanged for all roles
- Shared consumers:
  - `useProfileSignoffs` and `SystemProfileDetailDialog` will automatically behave correctly once stale rows are truly soft-deleted
  - review sign-off consumers benefit from the same fix
- Audit / compliance:
  - preserves soft-delete model and historical traceability
  - avoids duplicate active sign-off records, which is critical for inspection integrity
- i18n:
  - no new user-facing strings required unless we improve specific error toasts
- TypeScript/types:
  - no type changes required
- Role-based UI:
  - no conditional UI change required; this is data integrity + RLS correction

Files affected:
- `supabase/migrations/<new_migration>.sql`
- `src/hooks/useSystemProfiles.ts`
- `src/hooks/useReviewCase.ts`

Validation checklist after implementation:
- Return a profile to draft, change SA/QA/BO, resubmit: only current reviewers appear as active sign-offs
- Old objection no longer drives the “Objections have been raised” banner
- Return profile to draft: active sign-offs immediately disappear
- Repeat equivalent test for review case `plan_review` and `execution_review`
