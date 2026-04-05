

# Plan: Create `get_ai_queued_tasks` RPC Migration

## Summary
Single SQL migration to add a SECURITY DEFINER RPC that lets the Worker (via super_user service account) retrieve all `ai_queued` tasks with review case and system profile context, bypassing RLS.

## Column Name Corrections Required
The provided SQL has three mismatches with the actual database schema:

| RPC Reference | Actual Column | Fix |
|---|---|---|
| `rc.period_start_date` | `rc.review_period_start` | Rename alias |
| `rc.period_end_date` | `rc.review_period_end` | Rename alias |
| `review_level INTEGER` (return type) | `review_level TEXT` (actual type) | Change return type to TEXT |

Also, `has_role` second param needs explicit cast to `app_role`.

## Migration SQL (corrected)

```sql
CREATE OR REPLACE FUNCTION public.get_ai_queued_tasks()
RETURNS TABLE (
  task_id          UUID,
  task_title       TEXT,
  task_group       TEXT,
  review_case_id   UUID,
  assigned_to      UUID,
  system_name      TEXT,
  period_start     DATE,
  period_end       DATE,
  risk_level       TEXT,
  gamp_category    TEXT,
  review_level     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_user'::app_role) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  SELECT
    rt.id                AS task_id,
    rt.title             AS task_title,
    rt.task_group,
    rt.review_case_id,
    rt.assigned_to,
    sp.name              AS system_name,
    rc.review_period_start AS period_start,
    rc.review_period_end   AS period_end,
    sp.risk_level,
    sp.gamp_category,
    rc.review_level
  FROM review_tasks rt
  JOIN review_cases rc ON rc.id = rt.review_case_id
  JOIN system_profiles sp ON sp.id = rc.system_id
  WHERE rt.status = 'ai_queued'
    AND rt.is_deleted = false
    AND rc.is_deleted = false
    AND sp.is_deleted = false
  ORDER BY rt.updated_at ASC;
END;
$$;
```

## Impact Assessment
- **RLS**: No changes to existing policies. Function uses SECURITY DEFINER to bypass RLS, restricted to super_user via `has_role` check.
- **Existing components**: No frontend changes. No hooks consume this RPC (it's for the external Python worker).
- **Audit trail**: N/A — read-only function.
- **i18n**: No new strings.
- **TypeScript types**: No changes needed (worker is external Python).

## Files Changed
- `supabase/migrations/<timestamp>.sql` — new migration (single file)

