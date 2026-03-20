

## Fix: `suggestReviewLevel()` incorrect results for 3 combinations

### Problem
The function groups GAMP Cat 1 and Cat 3 together, causing 3 wrong results:
- Any Risk + Cat 1 → should always be Level 1 (Cat 1 was returning Level 2 for High)
- Medium + Cat 3 → should be Level 2 (was returning Level 1)
- Low + Cat 4 → should be Level 2 (was returning Level 1)

### Change
**File: `src/lib/gxpClassifications.ts`** — Replace the `suggestReviewLevel` function body (lines ~99-113) with a lookup table mapping all 12 Risk×GAMP combinations explicitly. No other files or functions touched.

```typescript
const REVIEW_LEVEL_MATRIX: Record<string, string> = {
  'Low_1': '1', 'Medium_1': '1', 'High_1': '1',
  'Low_3': '1', 'Medium_3': '2', 'High_3': '2',
  'Low_4': '2', 'Medium_4': '2', 'High_4': '3',
  'Low_5': '2', 'Medium_5': '3', 'High_5': '3',
};
return REVIEW_LEVEL_MATRIX[`${riskLevel}_${gampCategory}`] ?? null;
```

Single file, single function. No UI, DB, or other logic changes.

