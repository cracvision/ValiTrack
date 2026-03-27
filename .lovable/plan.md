

## Plan: Delete Review Case in Draft State

### Summary
Add a "Delete Draft" button with confirmation dialog to soft-delete review cases in draft status. Includes mandatory reason, audit logging, and navigation back to list.

### Files to Create

**1. `src/components/reviews/DeleteReviewDraftDialog.tsx`**

AlertDialog component with:
- Props: `open`, `onOpenChange`, `reviewCase`
- State: `reason` (string), `isDeleting` (boolean)
- Shows review case title + system name + year for confirmation
- Textarea for mandatory reason (min 10 chars), with inline validation message
- "Delete" button disabled until reason >= 10 chars
- On confirm:
  1. Soft-delete: `supabase.from('review_cases').update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: user.id, updated_at: new Date().toISOString(), updated_by: user.id }).eq('id', reviewCase.id).eq('status', 'draft')`
  2. Check returned data — if no rows matched, show error toast (race condition: someone advanced the status)
  3. Audit log: insert `REVIEW_CASE_DELETED` with system_name, system_id, review_period, review_level, reason, user context
  4. Success toast, invalidate `review-cases` + `review-case` + `dashboard-systems` queries, navigate to `/reviews`
- Do NOT touch `frozen_system_snapshot` or cascade to related records

### Files to Modify

**2. `src/pages/ReviewCaseDetail.tsx`**
- Import `Trash2` icon and `DeleteReviewDraftDialog`
- Add state: `const [deleteOpen, setDeleteOpen] = useState(false)`
- In the header buttons area (line ~145-155), add Delete Draft button to the LEFT of Edit Draft:
  - Same visibility condition as Edit Draft: `status === 'draft' && (user.id === system_owner_id || super_user)`
  - `variant="outline"` with destructive styling (`className="border-destructive text-destructive hover:bg-destructive/10"`)
  - `Trash2` icon + `t('reviews.actions.deleteDraft')`
- Render `<DeleteReviewDraftDialog>` at bottom of component

**3. `src/locales/en/common.json`**
- Add `reviews.actions.deleteDraft` and `reviews.deleteModal.*` keys as specified

**4. `src/locales/es/common.json`**
- Same structure with Spanish translations

### Impact Assessment
- **RLS**: No changes needed — existing UPDATE policy on `review_cases` allows SO, QA, and super_user to update; `.eq('status', 'draft')` guards draft-only
- **List filtering**: Already has `.eq('is_deleted', false)` — no changes needed
- **Audit trail**: New `REVIEW_CASE_DELETED` action with full context
- **Cascade**: None — only the review_case record is soft-deleted
- **Snapshot**: Immutable, not touched
- **Migration**: None required
- **i18n**: All strings in both EN and ES

### Technical Details

Button order in header (left to right):
```text
[Delete Draft]  [Edit Draft]  [Submit for review]
 destructive     outline        primary
```

The `.eq('status', 'draft')` safety net ensures that if another user advances the review case between the page load and the delete click, the update matches zero rows. We detect this by checking `data` length and show the error toast.

