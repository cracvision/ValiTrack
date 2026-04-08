

# Fix: Role Label in Welcome Email

## Problem
The welcome email displays the raw role code (`business_owner`) instead of a human-readable label (`Business Owner`).

## Solution

Add a `ROLE_LABELS` map at the top of `send-notification/index.ts` and use it in the `account_welcome` template body.

### Changes

**`supabase/functions/send-notification/index.ts`**

1. Add a role label map near the top (after imports/constants):
```typescript
const ROLE_LABELS: Record<string, string> = {
  super_user: "Super User",
  system_owner: "System Owner",
  system_administrator: "System Administrator",
  business_owner: "Business Owner",
  quality_assurance: "Quality Assurance",
  it_manager: "IT Manager",
};
```

2. In both EN and ES `account_welcome` body templates, replace `d.role` with `ROLE_LABELS[d.role] || d.role` (lines ~598 and ~611):
```typescript
detailRow("Role", ROLE_LABELS[d.role] || d.role)
// and
detailRow("Rol", ROLE_LABELS[d.role] || d.role)
```

No other files affected. One-line change in two places plus the map constant.

