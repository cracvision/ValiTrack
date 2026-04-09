

# Fix: AI Findings Not Auto-Populating

## Root Cause

Three bugs in `useTaskExecution.ts` lines 170-209:

1. **Wrong JSON path** (line 171): Code reads `analysis?.critical_findings` but the AI result stores findings at `analysis?.detailed_findings`. The `critical_findings` array has a different structure (used in the `AiTaskResult` type for the summary panel). The `detailed_findings` array contains the actual per-finding objects with `title`, `description`, `category`, `severity`, `regulatory_reference`.

2. **Title uses `cf.description` instead of `cf.title`** (line 200): `cf.description?.substring(0, 200)` is used for the finding title — should use `cf.title` first, falling back to description.

3. **Category inferred from task title only** (line 203): `categoryFromTask(task.title)` ignores the AI's freetext `category` field (e.g., "Software Lifecycle Management"). All findings from a single task get the same category. Should first try to map the AI's `cf.category` freetext to our enum, then fall back to task title inference.

## Fix (single file: `src/hooks/useTaskExecution.ts`)

### Change 1: Read from both `detailed_findings` and `critical_findings`
```typescript
const detailedFindings = analysis?.detailed_findings || analysis?.critical_findings || [];
```

### Change 2: Add `inferCategory` function that maps AI freetext categories
New function alongside `categoryFromTask`:
```typescript
const inferCategory = (aiCategory: string | undefined, taskTitle: string): string => {
  if (aiCategory) {
    const lower = aiCategory.toLowerCase();
    if (lower.includes('incident')) return 'incident_trend';
    if (lower.includes('change')) return 'change_control';
    if (lower.includes('access') || lower.includes('user')) return 'access_control';
    if (lower.includes('audit')) return 'audit_trail';
    if (lower.includes('backup') || lower.includes('restore')) return 'backup_restore';
    if (lower.includes('integrity') || lower.includes('data')) return 'data_integrity';
    if (lower.includes('training')) return 'training';
    if (lower.includes('performance')) return 'performance';
    if (lower.includes('vendor') || lower.includes('supplier') || lower.includes('lifecycle')) return 'vendor';
    if (lower.includes('regulat')) return 'regulatory';
    if (lower.includes('document') || lower.includes('sop')) return 'documentation';
    if (lower.includes('config')) return 'configuration';
  }
  return categoryFromTask(taskTitle);
};
```

### Change 3: Fix finding title and category in insert
```typescript
title: cf.title || cf.description?.substring(0, 200) || `Finding ${i + 1}`,
category: inferCategory(cf.category, task.title),
```

### Change 4: Add console logging for debugging
Add `console.log` before the findings loop to confirm execution path and data shape. Add `console.error` on insert failure.

## Impact
- No DB changes, no RLS changes, no i18n changes
- Only `useTaskExecution.ts` modified
- Existing findings (if any) unaffected — duplicate prevention uses `ai_task_result_id`

