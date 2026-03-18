

## Fix: Hide Actions column for non-editor roles

Two changes in `src/pages/SystemProfiles.tsx`:

1. **Line 205** — Wrap the Actions `<TableHead>` with `{canEdit && ...}`
2. **Lines 247-258** — Wrap the Actions `<TableCell>` with `{canEdit && ...}` (the whole cell, not just its contents)

