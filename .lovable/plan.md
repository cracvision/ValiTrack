

# Plan: Iteration 3A — Review Cases Foundation

## Scope

Build the core Review Cases module: 4 database tables, workflow state machine, CRUD UI, detail page with stepper, dashboard integration, and full i18n.

---

## Phase 1: Database Migration (single migration)

Create all 4 tables in one migration with RLS, triggers, indexes, and seed data:

1. **`review_cases`** — linked to `system_profiles`, 6-status workflow (`draft`, `in_preparation`, `in_progress`, `under_review`, `approved`, `rejected`), frozen system snapshot (JSONB), role assignment UUIDs, separation-of-duties constraint (`system_owner_id != qa_id`), soft delete columns, `updated_at` trigger
2. **`review_case_transitions`** — append-only audit table (NO `updated_at`, NO soft delete), references `review_cases(id)`
3. **`task_templates`** — 36 seed rows for review task definitions, `updated_at` trigger, soft delete columns
4. **`review_tasks`** — linked to `review_cases` and `task_templates`, `updated_at` trigger, soft delete columns

RLS policies per the spec: role-based SELECT on review_cases via assigned roles + `has_role('super_user')`, INSERT restricted to SO/SU, UPDATE restricted to SO/QA/SU. Transitions: SELECT via parent case access, INSERT by authenticated. Templates: read-only for all, full access for SU. Tasks: SELECT via assignment or parent case, UPDATE by assignee/SU, INSERT by authenticated.

Seed 36 task templates using `(SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'super_user' LIMIT 1)` for `created_by`, with idempotent `WHERE NOT EXISTS` guard.

## Phase 2: TypeScript Types & Workflow Logic

- **`src/types/index.ts`**: Replace old `ReviewStatus` with 6-state type. Add `ReviewLevel`, `ReviewConclusion`, `TaskGroup`, `TaskPhase`, `TaskExecutionType`, `TaskStatus`. Replace old `ReviewCase` interface with full version (frozen_system_snapshot, role UUIDs, conclusion fields). Add `ReviewCaseTransition`, `ReviewTask`, `TaskTemplate` interfaces. Update `AppRole` to include `it_manager`.
- **`src/lib/reviewWorkflow.ts`** (new): Transition map, `getValidTransitions()`, `canTransition()`, `getTransitionRule()`, `calculateReviewLevel()`, status/level/conclusion display configs.

## Phase 3: Data Hooks

- **`src/hooks/useReviewCases.ts`**: List review cases with system name join, filter by status/system, create mutation (inserts case + initial transition + frozen snapshot)
- **`src/hooks/useReviewCase.ts`**: Single case fetch by ID with system info, transition mutation (validates via workflow map, inserts transition record, updates case status + conclusion if approving)
- **`src/hooks/useReviewTransitions.ts`**: Fetch transitions for a case joined with `app_users` for names

## Phase 4: UI Components

- **`src/components/reviews/ReviewStatusBadge.tsx`**: Badge using `REVIEW_STATUS_CONFIG` colors
- **`src/components/reviews/ReviewWorkflowStepper.tsx`**: 6-step horizontal stepper (Draft → In prep → In progress → Under review → Approved), handles rejected state with red X
- **`src/components/reviews/CreateReviewDialog.tsx`**: 2-step dialog — Step 1: select system (filtered by SO role or all for SU), auto-populate fields including `calculateReviewLevel()`. Step 2: summary with editable title/due date. Validates separation of duties. On submit: serialize system to frozen snapshot, insert case, insert transition.
- **`src/components/reviews/ReviewActionButtons.tsx`**: Context-aware buttons from `getValidTransitions()`. Reject opens reason dialog, Approve opens conclusion selection dialog.
- **`src/components/reviews/TransitionHistory.tsx`**: List of transitions with user names, relative timestamps, from→to badges, reason in muted italic.

## Phase 5: Pages

- **`src/pages/ReviewCases.tsx`** (replace placeholder): Table with columns (System, Title, Period, Level, Status, Due date, Initiated by), filters by status/system, "New review" button opening CreateReviewDialog, empty state, row click navigates to `/reviews/:id`
- **`src/pages/ReviewCaseDetail.tsx`** (new): Back link, header with title + status badge + action buttons, workflow stepper, 2-column info grid (review details + role assignments on left, frozen snapshot on right), tasks placeholder section showing template count, transition history at bottom
- **`src/App.tsx`**: Add route `/reviews/:id` for ReviewCaseDetail

## Phase 6: Dashboard Integration

- **`src/hooks/useDashboardSystems.ts`**: After fetching systems, query latest `review_cases` per system. Map case status to `ReviewStatusType`: draft/in_preparation/in_progress/rejected → `in_progress`, under_review → `pending_approval`, approved + future next_review → `compliant`. Fall back to date-based calculation when no case exists.
- **`src/components/dashboard/SystemCard.tsx`** and **`ReviewPhaseStepper.tsx`**: Now render real phase data when a review case exists.

## Phase 7: i18n

Add all keys to both `en/common.json` and `es/common.json`: page titles/subtitles, 6 status labels, 3 review levels with descriptions, 3 conclusions, table headers, create dialog labels/validation, detail page sections, action buttons, transition history, empty states, 8 task group names. All Spanish translations will be real Spanish.

---

## Files Created/Modified

| File | Action |
|------|--------|
| `supabase/migrations/` (new migration) | Create 4 tables + RLS + triggers + seed |
| `src/types/index.ts` | Update types |
| `src/lib/reviewWorkflow.ts` | New |
| `src/hooks/useReviewCases.ts` | New |
| `src/hooks/useReviewCase.ts` | New |
| `src/hooks/useReviewTransitions.ts` | New |
| `src/components/reviews/CreateReviewDialog.tsx` | New |
| `src/components/reviews/ReviewStatusBadge.tsx` | New |
| `src/components/reviews/ReviewWorkflowStepper.tsx` | New |
| `src/components/reviews/ReviewActionButtons.tsx` | New |
| `src/components/reviews/TransitionHistory.tsx` | New |
| `src/pages/ReviewCases.tsx` | Replace placeholder |
| `src/pages/ReviewCaseDetail.tsx` | New |
| `src/App.tsx` | Add route |
| `src/hooks/useDashboardSystems.ts` | Update with review case lookup |
| `src/components/dashboard/SystemCard.tsx` | Update stepper integration |
| `src/components/dashboard/ReviewPhaseStepper.tsx` | Update with real data |
| `src/locales/en/common.json` | Add keys |
| `src/locales/es/common.json` | Add keys |

---

## Key Constraints Honored

- Separation of duties enforced at DB (CHECK) and UI (validation) levels
- `review_case_transitions` is append-only — no soft delete, no updated_at
- Every status change inserts a transition record
- Rejection requires mandatory reason; approval requires mandatory conclusion
- Frozen system snapshot captured at creation time
- All queries filter `is_deleted = false`
- No localStorage usage
- All strings through `t()`

