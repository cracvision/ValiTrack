
## Iteration 3B-1: Workflow Expansion (6 → 8 States) — IMPLEMENTED

### New workflow
`draft → plan_review → plan_approval → approved_for_execution → in_progress → execution_review → approved / rejected`

### Changes made
1. **Database**: CHECK constraint updated, existing data migrated (`in_preparation` → `plan_review`, `under_review` → `execution_review`)
2. **Types**: `ReviewStatus` updated with 8 states
3. **Workflow engine**: Full rewrite with `labelKey` on each transition rule, 5-phase stepper config
4. **Stepper**: 5 grouped phases (Planning, Plan Approval, Execution, Final Review, Approved)
5. **Action buttons**: Reusable reason dialog for all `requiresReason` transitions
6. **Status badge & transition history**: Accept `string` for backwards compat with old states
7. **Detail page**: Plan approval + approved_for_execution banners, updated task messages
8. **Review list**: 8-state filter dropdown
9. **Dashboard**: Updated status mapping, phase-specific next action messages
10. **i18n**: All keys in EN + ES with real Spanish translations

---

## Iteration 3B-1 Addendum: Reviewer Sign-Off Mechanism — IMPLEMENTED

### Summary
Mandatory SA + QA sign-off gate for `plan_review` and `execution_review` states. Reviewers choose "No objections" or "Raise objections" (with mandatory comments). Forward advancement blocked until all approved with no objections.

### Changes made
1. **Database**: `review_signoffs` table with RLS (SELECT/UPDATE/INSERT), `get_signoff_summary` RPC, audit_log INSERT policy
2. **Types**: `ReviewSignoff` and `SignoffSummary` interfaces added
3. **Hook**: `useReviewSignoffs.ts` — queries signoffs, derives canAdvance/hasObjections, submitDecision mutation with audit_log entry
4. **Component**: `ReviewSignoffPanel.tsx` — progress bar, per-reviewer status cards, decision form with mandatory comments for objections
5. **Transition logic**: `useReviewCase.ts` — creates/resets signoff records on transition to plan_review or execution_review
6. **Detail page**: `ReviewCaseDetail.tsx` — signoff panel between role assignments and tasks, amber objection banner, passes canAdvanceSignoff/hasObjections to action buttons
7. **Action buttons**: `ReviewActionButtons.tsx` — blocks forward transitions (plan_review→plan_approval, execution_review→approved/rejected) when signoffs incomplete
8. **Dashboard**: `useDashboardSystems.ts` — parallel `Promise.all` for signoff summaries, `SystemCard.tsx` — signoff-aware next action messages
9. **i18n**: All signoff + next action keys in EN + ES

### Security & compliance
- canSignOff excludes system_owner_id AND initiated_by
- execution_review blocks both "Approve" and "Reject" (not just Approve) when signoffs incomplete
- Return/step-back transitions NEVER blocked
- Audit log entries for SIGNOFF_APPROVED and SIGNOFF_OBJECTED
- Signoffs reset to pending on re-entry to review phases
- Null check before creating signoffs for unassigned roles
