

## 3C-Fix-3: Dual Language Execution Instructions (EN + ES)

### Summary
Add `execution_instructions_es` column to `task_templates` and `review_tasks`. The frontend selects which language to display based on the user's i18n language preference, falling back to English if no Spanish translation exists.

### Changes

#### 1. Database Migration
- Add `execution_instructions_es TEXT` to `task_templates` and `review_tasks`
- Populate all 20 templates with Spanish translations (the UPDATE statements provided in the ticket)
- Backfill existing `review_tasks` from their linked templates
- Check AI_EVAL/APPR templates for any that have instructions needing translation

#### 2. Data Insert (separate from migration)
The 20 UPDATE statements for template Spanish text will use the insert tool since they're data updates, not schema changes. The ALTER TABLE for adding columns goes in a migration.

**Correction**: Per the project's guidelines, UPDATEs use the insert tool, not migrations. So the flow is:
- **Migration**: `ALTER TABLE` to add the two columns + comments
- **Insert tool**: All UPDATE statements for populating Spanish text + backfill review_tasks

#### 3. Task Generation — `src/lib/taskGeneration.ts`
- Add `execution_instructions_es` to the `TaskTemplate` interface
- Add `execution_instructions_es: template.execution_instructions_es` to the payload in `buildTaskPayloads`

#### 4. Task Loading — `src/hooks/useReviewTasks.ts`
- Add `execution_instructions_es: row.execution_instructions_es ?? undefined` to the mapping (line 58 area). Already uses `select('*')` so the column is fetched automatically.

#### 5. Types — `src/types/index.ts`
- Add `execution_instructions_es?: string | null` to `ReviewTask` interface
- Add same to `TaskTemplate` interface

#### 6. Frontend — `src/components/tasks/TaskDetailPanel.tsx`
Replace the instructions prop with language-aware selection:

```typescript
const { i18n } = useTranslation();
const instructions = i18n.language === 'es' && task.execution_instructions_es
  ? task.execution_instructions_es
  : task.execution_instructions;
```

Pass `instructions` instead of `task.execution_instructions` to `TaskInstructionsSection`. Also update the guard condition (line 217) to check both columns.

#### 7. No other changes
- `TaskInstructionsSection` component: unchanged (receives instructions as prop)
- Checkoff logic: unchanged (step_index is language-independent)
- RLS policies: unchanged
- `instruction_step_count`: unchanged

### Files Modified

| File | Change |
|------|--------|
| New migration | ALTER TABLE add columns to both tables |
| Insert tool (data) | 20 template UPDATEs + review_tasks backfill |
| `src/lib/taskGeneration.ts` | Add field to interface + payload |
| `src/hooks/useReviewTasks.ts` | Add field to row mapping |
| `src/types/index.ts` | Add field to ReviewTask + TaskTemplate |
| `src/components/tasks/TaskDetailPanel.tsx` | Language-aware instruction selection |

