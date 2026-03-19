

## Add rejection alert banner to ReviewCaseDetail

### What
When `reviewCase.status === 'rejected'`, show a red destructive alert banner between the header (line 120) and the workflow stepper (line 123). The banner displays who rejected and why, using data already available from `transitions`.

### Implementation

**File: `src/pages/ReviewCaseDetail.tsx`**

1. Import `AlertTriangle` from lucide-react and `Alert, AlertTitle, AlertDescription` from `@/components/ui/alert`
2. After the header block (line 120) and before the stepper (line 123), add a conditional block:
   - Find the most recent transition where `to_status === 'rejected'` from the already-loaded `transitions` array
   - Render a destructive-styled Alert with `AlertTriangle` icon
   - Title: `"{transitioned_by_name} rejected this review: '{reason}'"`
   - Description: `"Return to draft to make corrections."`
3. Only renders when `reviewCase.status === 'rejected'` — automatically disappears when status changes back to draft

No new hooks, queries, or database changes needed — all data comes from the existing `useReviewTransitions` hook which already resolves user names via the `resolve_user_names` RPC.

### Styling
Use the existing `Alert` component with `variant="destructive"` plus a light red background (`bg-destructive/10 border-destructive/30`) for the prominent banner look.

