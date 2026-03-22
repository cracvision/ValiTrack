

## Fix: Logo caching on published site

### Root Cause

Supabase Storage serves public objects through a CDN with aggressive caching headers. When you replaced the file at the same path (`images/ValiTrack_Logo.png`), the CDN continued serving the cached (old) version. The preview works because it hits Supabase directly or uses a different cache layer.

This is a known Supabase Storage CDN behavior — same filename = cached response until the CDN TTL expires (can take hours or even days).

### Solution: Cache-busting query parameter

Append a version query string to the logo URL so the CDN treats it as a new resource. This forces a fresh fetch without changing the actual storage path.

**File: `src/pages/Auth.tsx`** (line 12)
```typescript
const LOGO_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/images/ValiTrack_Logo.png?v=2`;
```

**File: `src/components/AppSidebar.tsx`** (line 12)
```typescript
const LOGO_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/images/ValiTrack_Logo_small.png?v=2`;
```

Two lines changed, no other files affected. After publishing, the `?v=2` parameter bypasses the CDN cache. Any future logo replacement just needs bumping `v=2` to `v=3`, etc.

