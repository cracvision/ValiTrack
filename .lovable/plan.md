
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
