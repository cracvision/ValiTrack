

## Fix: Instruction Checkbox Bugs + Refined Business Rules

### Root Causes

1. **Bug 1 (checkboxes on pending)**: `TaskInstructionsSection` shows checkboxes when `taskStatus === 'in_progress' || taskStatus === 'completed'` (line 61) — this is correct. But the `canInteract` prop passed from `TaskDetailPanel` is `execution.canAddNotes && task.status === 'in_progress'`. The `canAddNotes` check doesn't include the System Owner. However, the actual checkbox enable/disable depends on `canInteract` AND `taskStatus === 'completed'` being hardcoded as disabled in the component (line 107: `isDisabled = !canInteract || taskStatus === 'completed'`). So completed tasks are always disabled. The real issue is that `canInteract` should also be `true` for SO on in_progress tasks, and for SO/super_user on completed tasks.

2. **Bug 2 (can't uncheck)**: The RLS UPDATE policy exists and looks correct from the last migration. Need to verify the frontend toggle mutation is using the right update fields (`updated_by` is required). Looking at `useTaskCheckoffs.ts`, the update uses `as any` cast — need to verify the fields match the table schema.

### Changes

#### 1. Database: Replace UPDATE policy on `task_instruction_checkoffs`
New policy handles both `in_progress` (assignee/SO/super_user) and `completed` (SO/super_user only) states.

#### 2. `TaskDetailPanel.tsx` — Fix `canInteract` prop
Replace the single `canInteract` with status-aware logic:
```typescript
const canInteractCheckoffs = useMemo(() => {
  if (task.status === 'in_progress') {
    return execution.isAssignee || execution.isSystemOwner || execution.isSuperUser;
  }
  if (task.status === 'completed') {
    return execution.isSystemOwner || execution.isSuperUser;
  }
  return false;
}, [task.status, ...]);
```

This requires exposing `isAssignee`, `isSystemOwner`, `isSuperUser` from `useTaskExecution` hook.

#### 3. `useTaskExecution.ts` — Expose role booleans
Add `isAssignee`, `isSystemOwner`, `isSuperUser` to the return object.

#### 4. `TaskInstructionsSection.tsx` — Fix disabled logic
Remove the hardcoded `taskStatus === 'completed'` disable. The parent now controls interactivity correctly via `canInteract`:
```typescript
const isDisabled = !canInteract || isToggling;
```
(No longer force-disabling on completed status — parent decides.)

#### 5. `useTaskCheckoffs.ts` — Verify uncheck mutation
Ensure the soft-delete UPDATE includes `updated_by: user.id` (required by schema). Check current code has this field.

### Files Changed

| File | Change |
|------|--------|
| New migration | Replace UPDATE policy with status-aware rules |
| `src/hooks/useTaskExecution.ts` | Expose `isAssignee`, `isSystemOwner`, `isSuperUser` |
| `src/components/tasks/TaskDetailPanel.tsx` | Status-aware `canInteract` logic |
| `src/components/tasks/TaskInstructionsSection.tsx` | Remove hardcoded completed disable |

