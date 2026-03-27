

## Duplicate System Profile Prevention (System Identifier Uniqueness)

### Problem
Users can create multiple system profiles with the same System Identifier (e.g., "SYS-MES-003"), breaking the one-system-one-profile principle.

### Plan

#### 1. Database migration — Case-insensitive partial unique index
```sql
CREATE UNIQUE INDEX idx_unique_system_identifier
ON public.system_profiles (LOWER(system_identifier))
WHERE is_deleted = false;
```

#### 2. Frontend — Real-time validation in SystemProfileForm
In `src/components/SystemProfileForm.tsx`:

- Add local state for duplicate check: `identifierError`, `identifierChecking`
- Add a debounced (~500ms) check on the `system_identifier` field using `onBlur` or debounced `onChange`
- Query: `supabase.from('system_profiles').select('id, name').ilike('system_identifier', value).eq('is_deleted', false).neq('id', currentProfileId)` (exclude self when editing)
- If match found: show red border + red text on input, display inline error with conflicting system name, disable submit button
- If no match: clear error, re-enable submit

#### 3. Backend error handling — useSystemProfiles hook
In `src/hooks/useSystemProfiles.ts`:

- In both `addSystem` and `updateSystem`, catch Postgres error code `23505` and show a user-friendly toast using the new i18n key `systemProfiles.identifierDuplicateError`

#### 4. i18n keys
Add to `systemProfiles` namespace in both locale files:

**EN**: `identifierDuplicate` and `identifierDuplicateError`
**ES**: Same keys with Spanish translations

### Files modified
| File | Change |
|---|---|
| New migration | Case-insensitive partial unique index on `system_profiles(LOWER(system_identifier))` |
| `src/components/SystemProfileForm.tsx` | Debounced duplicate check on identifier field; red styling + inline error; disable submit |
| `src/hooks/useSystemProfiles.ts` | Catch `23505` in addSystem/updateSystem with i18n toast |
| `src/locales/en/common.json` | Add `systemProfiles.identifierDuplicate` and `identifierDuplicateError` |
| `src/locales/es/common.json` | Same keys in Spanish |

### Impact evaluation
- **RLS**: Uses existing SELECT policies — the duplicate check query runs as the authenticated user who already has visibility on system profiles
- **Soft deletes**: Index and query both filter `is_deleted = false` — deleted profiles don't block reuse
- **Edit case**: Self-exclusion via `neq('id', editingSystem.id)` prevents false positives
- **Case sensitivity**: `LOWER()` in index + `ilike` in query ensure case-insensitive matching
- **Components**: Change scoped to form + hook only; no other components affected
- **Types**: No TypeScript type changes needed

