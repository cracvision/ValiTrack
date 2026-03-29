

# Add REVIEW_CASE_CANCELLED Audit Log Entry

## Status
- **i18n keys**: Already present in both EN and ES — no changes needed
- **CreateReviewDialog**: Already excludes `cancelled` (line 70: `.neq('status', 'cancelled')`) — no changes needed
- **Audit log entry**: Missing — needs to be added

## Single Change

### `src/hooks/useReviewCase.ts`
After the cancellation metadata block (lines 88-92) and before the status update executes, fetch the review case's `frozen_system_snapshot` to get `system_name`. Then after the transition record insert succeeds, add a `REVIEW_CASE_CANCELLED` audit log entry:

```typescript
if (input.toStatus === 'cancelled') {
  // Fetch system name from frozen snapshot for audit
  const { data: rcSnap } = await supabase
    .from('review_cases')
    .select('frozen_system_snapshot')
    .eq('id', input.reviewCaseId)
    .single();

  const systemName = (rcSnap?.frozen_system_snapshot as any)?.name || '';

  await supabase.from('audit_log').insert({
    user_id: user.id,
    action: 'REVIEW_CASE_CANCELLED',
    resource_type: 'review_case',
    resource_id: input.reviewCaseId,
    details: {
      system_name: systemName,
      from_status: input.fromStatus,
      reason: input.reason || '',
    },
  });
}
```

This block goes after the transition record insert (after line ~127), so both the status update and transition record are already committed. The audit entry is in addition to the `E_SIGNATURE` entry created by the modal.

## Files
| File | Action |
|------|--------|
| `src/hooks/useReviewCase.ts` | MODIFY — add cancellation audit log block |

No other files need changes.

