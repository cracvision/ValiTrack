

# E-Signature Implementation — Approved for Implementation

## Namespace Confirmation
Existing i18n keys use **`esignature`** (lowercase) in both locale files and all `t()` calls. All new keys will be added under this same `esignature` namespace — no camelCase `eSignature` namespace will be created.

## Implementation — 7 Files

### 1. `src/components/reviews/ESignatureModal.tsx` — FULL REWRITE
Replace current minimal modal with spec-compliant version:
- Signer info card with name, role, locale-formatted date/time
- `actionDescription` prop for contextual system info
- Conclusion radio group (3 options, no default, only when `showConclusionSelector`)
- Reason textarea (min 10 chars, char counter, only when `showReasonField`)
- Comment textarea (always visible, optional)
- Password field with show/hide eye toggle, error clears on typing, Enter submits
- Amber legal disclaimer card (dark mode: `dark:bg-neutral-800 dark:text-amber-400 dark:border-neutral-700`)
- `onInteractOutside` prevented, full state reset on close
- Internal `logESignatureAttempt` helper using `resource_type: 'review_case'` (singular)
- New props: `onSuccess(ESignatureResult)`, `actionDescription`, `showReasonField`, `showConclusionSelector`, `reviewCaseId`, `transitionLabel`

### 2. `src/components/reviews/ReviewActionButtons.tsx` — MODIFY
- Add `systemIdentifier` prop
- Add `getESignatureDescription()` helper using `systemName` + `systemIdentifier`
- Replace `handleESign` with `handleESignatureSuccess(result: ESignatureResult)` that extracts conclusion/reason and calls existing transition mutation
- Update modal render to pass new props (`actionDescription`, `showReasonField`, `showConclusionSelector`, `onSuccess`)
- E-sig transitions bypass existing reason/conclusion dialogs (already the case via intercept order)

### 3. `src/pages/ReviewCaseDetail.tsx` — MINOR
- Pass `systemIdentifier={snapshot?.system_identifier || ''}` to `ReviewActionButtons`

### 4. `src/hooks/useESignature.ts` — MODIFY
- Fix `resource_type` from `'review_cases'` → `'review_case'`
- Add `comment` field to audit log details JSON

### 5. `src/components/reviews/TransitionHistory.tsx` — MINOR
- Fix query `resource_type` from `'review_cases'` → `'review_case'`
- Add tooltip on lock icon: `t('esignature.eSigned')`
- Display e-signature comment if present

### 6-7. `src/locales/en/common.json` & `src/locales/es/common.json` — ADD KEYS
Add under existing `esignature` (lowercase) namespace:
- `signerInfo`, `signerName`, `signerRole`, `signerDate`
- `comment`, `commentPlaceholder`
- `reasonLabel`, `reasonPlaceholder`
- `conclusionLabel`, `conclusions.remains_validated`, `conclusions.requires_remediation`, `conclusions.requires_revalidation`
- `descriptions.approvePlan`, `descriptions.approveReview`, `descriptions.rejectReview` (with `{{systemName}}`, `{{systemId}}` interpolation)
- `eSigned`, `verificationError`

## No Database Changes
All audit entries use existing `audit_log` table with `E_SIGNATURE` / `E_SIGNATURE_FAILED` actions and `resource_type: 'review_case'`.

## Impact Assessment
- **RLS**: No change — audit_log INSERT allows `user_id = auth.uid()`
- **Non-e-sig transitions**: Untouched — reason/approve dialogs remain for their flows
- **i18n**: All strings via `t()`, both EN and ES, under existing `esignature` namespace
- **Dark mode**: Disclaimer card follows neutral dark pattern

