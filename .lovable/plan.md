

## Fix two issues in ReviewCaseDetail

### Issue 1: Approval notes not visible in Status History

**File: `src/hooks/useReviewCase.ts`** (lines 90-99)

When inserting the transition record, build a `reason` string for approvals that includes the conclusion label and notes. Change the insert block:

```typescript
// Build reason for the transition record
let transitionReason = input.reason || null;
if (input.toStatus === 'approved' && (input.conclusion || input.conclusionNotes)) {
  const conclusionLabel = input.conclusion?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';
  transitionReason = `Conclusion: ${conclusionLabel}.${input.conclusionNotes ? ' ' + input.conclusionNotes : ''}`;
}
```

Then use `transitionReason` in the insert. No UI changes needed — `TransitionHistory` already renders `reason`.

### Issue 2: Approved step shows blue instead of green

**File: `src/components/reviews/ReviewWorkflowStepper.tsx`**

The stepper treats `currentIndex` as the active step, but when `status === 'approved'` (the last step), it should show all steps as completed. Fix: when status is `approved`, set `currentIndex` to `STEPS.length` (beyond the array), so every step gets `idx < currentIndex` → completed (green + checkmark).

```typescript
const currentIndex = effectiveStatus === 'approved' 
  ? STEPS.length 
  : STEPS.indexOf(effectiveStatus);
```

This makes all 5 bars green with checkmarks when approved.

