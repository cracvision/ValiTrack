

# Forgot Password — Custom Flow with ValiTrack Branding

## Overview

Complete self-service password reset flow using ValiTrack's existing `send-notification/` infrastructure. Secure token-based approach with SHA-256 hashing, rate limiting, and no email enumeration.

**Current state:** `/reset-password` exists but only handles first-login mandatory password changes (requires authenticated user). The new flow adds unauthenticated token-based reset via email.

---

## Changes

### 1. Database Migration: `password_reset_tokens` table

```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reset_tokens_hash ON password_reset_tokens(token_hash) WHERE used_at IS NULL;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
-- No policies = service_role only
```

No soft-delete (ephemeral security tokens). No audit columns (system-generated; audit_log used instead).

### 2. Edge Function: `request-password-reset/`

`verify_jwt = false` in config.toml.

Flow:
- Parse `{ email }`, validate format
- Lookup user in `app_users` (service_role) — check not blocked
- If not found/blocked: return 200 generic message, log to audit_log with `found: false`
- If found: rate-limit (≤3 tokens per email in 15 min), generate `crypto.randomUUID()`, SHA-256 hash, insert token (1hr expiry), build reset URL with raw token + email, call `send-notification/` with type `password_reset`, log to audit_log
- Always return same 200 response

### 3. Edge Function: `complete-password-reset/`

`verify_jwt = false` in config.toml.

Flow:
- Parse `{ token, email, new_password }`
- SHA-256 hash token, lookup in DB (match hash + email, unused, not expired)
- If invalid: return 400, audit log `PASSWORD_RESET_FAILED`
- If valid: validate password policy (reuse `_shared/passwordPolicy.ts`), check password history, update via `auth.admin.updateUserById`, mark token used, invalidate all other tokens for user, save to password_history, set `must_change_password = false`, send `account_password_changed` notification directly, audit log `PASSWORD_RESET_COMPLETED`
- Return 200 success

### 4. Email Template: `password_reset` in `send-notification/`

Add to `NOTIFICATION_TYPES` constant and `EMAIL_TEMPLATES`:
- Subject EN: `[ValiTrack] Password Reset Instructions`
- Subject ES: `[ValiTrack] Instrucciones para Restablecer Contraseña`
- Body: greeting, reset request confirmation, CTA button to reset URL, 1-hour expiry warning, security note about ignoring if not requested
- Same HTML structure as existing templates

### 5. Frontend: `/forgot-password` page

New page `src/pages/ForgotPassword.tsx`:
- ValiTrack logo, email input, "Send Instructions" button
- Language toggle (same as login page)
- System theme (same as login page)
- On submit: call `request-password-reset` via `supabase.functions.invoke()`
- Show success message regardless of response
- 60-second cooldown on submit button
- "Back to sign in" link → `/auth`

### 6. Frontend: Update `/reset-password` to handle both flows

Modify `src/pages/ResetPassword.tsx` to detect URL params `token` and `email`:
- **If `token` + `email` present**: show unauthenticated token-based reset form (new password + confirm + requirements), submit calls `complete-password-reset` Edge Function, on success redirect to `/auth` with toast
- **If user is authenticated with `must_change_password`**: existing behavior (unchanged)
- **If neither**: redirect to `/auth`

Add confirm password field and error states for expired/invalid/used tokens.

### 7. Frontend: Login page — add "Forgot Password?" link

Add link below sign-in button in `src/pages/Auth.tsx` → navigates to `/forgot-password`.

### 8. Routing

Add `/forgot-password` as public route in `src/App.tsx` alongside `/auth` and `/reset-password`.

### 9. i18n Keys

Add to `src/locales/en/auth.json` and `src/locales/es/auth.json`:
- `forgotPassword`, `forgotPasswordTitle`, `forgotPasswordSubtitle`, `sendInstructions`, `backToSignIn`, `resetPasswordTitle`, `resetPasswordButton`, `resetPasswordSuccess`, `resetLinkExpired`, `resetLinkUsed`, `resetLinkInvalid`, `resetEmailSent`, `confirmPassword`, `passwordsDoNotMatch`

### 10. Config

Add to `supabase/config.toml`:
```toml
[functions.request-password-reset]
verify_jwt = false

[functions.complete-password-reset]
verify_jwt = false
```

---

## Impact Assessment

| Area | Impact |
|------|--------|
| RLS | New table has no policies (service_role only) — correct for security tokens |
| Existing components | `ResetPassword.tsx` extended with dual-mode (token vs authenticated) |
| Audit trail | 3 new audit actions: `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `PASSWORD_RESET_FAILED` |
| i18n | ~14 new keys in both EN and ES |
| TypeScript types | No DB type changes needed in frontend (Edge Functions use service_role) |
| Security | No email enumeration, rate-limited, single-use tokens, password history enforced |

