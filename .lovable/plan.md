

## Add Role Assignments to Create Review Dialog (Step 2)

### Impact Assessment
- **RLS**: No impact — uses existing `useResolveUserNames` RPC (SECURITY DEFINER), safe for all roles
- **Components**: Only `CreateReviewDialog.tsx` modified; pattern matches `SystemProfileDetailDialog.tsx`
- **i18n**: New key `reviews.create.roleAssignments` in EN and ES
- **Types**: No changes needed — `SystemProfile` already has all role ID fields

### Changes

**1. `src/components/reviews/CreateReviewDialog.tsx`**
- Import `useResolveUserNames` from `@/hooks/useResolveUserNames`
- Import `Separator` from `@/components/ui/separator`
- Call `useResolveUserNames` with the 5 role IDs from `selectedSystem` (only resolves when step 2 is active and system is selected)
- Insert a role assignments section between the Due Date grid (line 209) and the action buttons (line 211):
  - A `<Separator />` 
  - Label "Role Assignments" in muted/semibold style
  - 2-column grid with role label (muted xs text) + resolved name (sm font-medium), same as `SystemProfileDetailDialog`
  - Show "—" for unassigned optional roles (business_owner, it_manager)

**2. `src/locales/en/common.json` and `src/locales/es/common.json`**
- Add `reviews.create.roleAssignments`: EN = "Role Assignments", ES = "Asignaciones de Roles"

