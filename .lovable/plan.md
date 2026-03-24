

## Iteration 3D: Completion Window + E-Signatures

This is a significant iteration with two distinct parts: (1) adding a completion window concept that separates the review period end from the work deadline, and (2) adding 21 CFR Part 11 e-signatures for critical QA transitions.

---

### Part 1: Completion Window

**Database Changes**
- Migration: `ALTER TABLE system_profiles ADD COLUMN completion_window_days INTEGER NOT NULL DEFAULT 90`
- Migration: `ALTER TABLE review_cases ADD COLUMN period_end_date DATE`
- Data backfill (insert tool): Set `period_end_date` from existing `review_period_end` column, then recalculate `due_date = period_end_date + completion_window_days` for all non-deleted review cases

**Types (`src/types/index.ts`)**
- Add `completion_window_days: number` to `SystemProfile`
- Add `period_end_date?: string` to `ReviewCase`

**System Profile Form (`SystemProfileForm.tsx`)**
- Add `completion_window_days` to form schema (number, default 90, min 30, max 180)
- Add number input field in Review Schedule section, between "Review Period" and the role assignments section
- Label: "Completion Window" / "Ventana de Completación", with help text and "days"/"días" suffix

**System Profile Detail (`SystemProfileDetailDialog.tsx`)**
- Add "Completion Window: 90 days" field in Review Schedule section, between Review Period and Next Review Date

**System Profile Hooks (`useSystemProfiles.ts`)**
- Add `completion_window_days` to `rowToSystemProfile`, `addSystem` insert, and `updateSystem` update payloads

**Dashboard Hook (`useDashboardSystems.ts`)**
- Add `completion_window_days` to the SystemProfile mapping
- The `computeReviewStatus` function already uses `next_review_date` — this stays as-is since `next_review_date` represents the period end. The real deadline is `due_date` on the review case. Dashboard cards with active review cases already reference the case's `due_date` for countdown. No change needed here since the dashboard computes from system profile dates (period end), and when a case exists, uses the case status directly.

**Review Case Creation (`CreateReviewDialog.tsx` + `useReviewCases.ts`)**
- When selecting a system, auto-calculate: `period_end_date = next_review_date`, `due_date = period_end_date + completion_window_days`
- Pass `period_end_date` in the insert payload
- Add `completion_window_days` to frozen snapshot

**Review Case Detail (`ReviewCaseDetail.tsx`)**
- Show `period_end_date` and `due_date` separately: "Period End Date" / "Fecha Fin del Período" and "Completion Due" / "Fecha de Completación"

**Review Case Hooks (`useReviewCase.ts`, `useReviewCases.ts`)**
- Map `period_end_date` from row data

**i18n keys** — Add completion window labels to both `en/common.json` and `es/common.json`

---

### Part 2: E-Signatures

**No database schema changes** — E-signature records use the existing `audit_log` table with actions `E_SIGNATURE` and `E_SIGNATURE_FAILED`. The `conclusion` column already exists on `review_cases`.

**New Component: `src/components/reviews/ESignatureModal.tsx`**
- Dialog with password field, mandatory reason (min 10 chars), and optional conclusion radio buttons (for `execution_review → approved` only)
- Shows action label, review title, signer name/role, and 21 CFR Part 11 disclaimer
- Displays error on failed password verification without closing
- Loading state during verification

**New Hook: `src/hooks/useESignature.ts`**
- `verifyAndSign()` function that:
  1. Calls `supabase.auth.signInWithPassword()` to verify the password
  2. On failure: logs `E_SIGNATURE_FAILED` to audit_log, throws error
  3. On success: logs `E_SIGNATURE` to audit_log with full details (transition, reason, conclusion, signer info)
  4. Returns success for caller to proceed with transition

**Workflow Config (`src/lib/reviewWorkflow.ts`)**
- Add `requiresESignature?: boolean` to `TransitionRule` interface
- Set `requiresESignature: true` on three transitions:
  - `plan_approval → approved_for_execution`
  - `execution_review → approved`
  - `execution_review → rejected`

**Review Action Buttons (`ReviewActionButtons.tsx`)**
- Add e-signature modal state management
- When a transition has `requiresESignature`, open `ESignatureModal` instead of executing directly
- For `execution_review → approved`: the conclusion selector moves INTO the e-signature modal (replacing the current approve dialog for this case)
- For `execution_review → rejected`: e-signature modal with reason only (no conclusion)
- On successful signature: execute the existing transition logic, then close modal

**Transition History (`TransitionHistory.tsx`)**
- For each transition, check if it matches a known e-signature transition pattern
- Query audit_log for `E_SIGNATURE` entries matching the review case
- Show lock icon and reason text for e-signed transitions
- For approved cases, show conclusion badge

**i18n keys** — Add all `esignature.*` keys to both locale files

---

### Files to Modify

| File | Change |
|------|--------|
| New migration | Add `completion_window_days` to system_profiles, `period_end_date` to review_cases |
| Insert tool (data) | Backfill `period_end_date` and recalculate `due_date` |
| `src/types/index.ts` | Add fields to SystemProfile and ReviewCase |
| `src/components/SystemProfileForm.tsx` | Add completion window field |
| `src/components/SystemProfileDetailDialog.tsx` | Display completion window |
| `src/hooks/useSystemProfiles.ts` | Map + persist completion_window_days |
| `src/hooks/useDashboardSystems.ts` | Map completion_window_days |
| `src/components/reviews/CreateReviewDialog.tsx` | Calculate period_end_date + due_date |
| `src/hooks/useReviewCases.ts` | Add period_end_date to insert + mapping |
| `src/hooks/useReviewCase.ts` | Map period_end_date |
| `src/pages/ReviewCaseDetail.tsx` | Show both dates |
| `src/lib/reviewWorkflow.ts` | Add requiresESignature flag |
| `src/components/reviews/ESignatureModal.tsx` | NEW component |
| `src/hooks/useESignature.ts` | NEW hook |
| `src/components/reviews/ReviewActionButtons.tsx` | Intercept e-sig transitions |
| `src/components/reviews/TransitionHistory.tsx` | Show e-signature indicators |
| `src/locales/en/common.json` | Add all new keys |
| `src/locales/es/common.json` | Add all new keys |
| `src/integrations/supabase/types.ts` | Will auto-regenerate |

### What Does NOT Change
- Review workflow states (same 8)
- Task generation, execution, phase dependencies
- RLS policies
- Sign-off mechanism
- Non-e-signature transitions work exactly as before

