# [Bug / Security] Rate limiting is per-instance only — doesn't protect API across Vercel deployments

**Priority:** High  
**Area:** API / Infrastructure  
**Affects:** `/api/process`, `/api/agent`, `/api/chat`, `/api/quotes`

---

## Problem

The current rate limiter (`src/lib/rate-limit.ts`) uses an **in-memory `Map`**:

```ts
const store = new Map<string, { count: number; resetAt: number }>();
```

On Vercel, each serverless function invocation may run on a **different container instance**. This means:

- User A makes 10 requests → hits instance 1 → counter = 10
- User A makes 10 more requests → hits instance 2 → counter resets to 0 again
- **Effective rate limit per user = (limit × number of active instances)**

A malicious user (or a runaway client bug) can exhaust:
- **Anthropic Claude API quota** — every `/api/process` call sends a Vision API request (~$0.01–0.05 per image)
- **Notion API rate limit** — 3 req/s per integration token; bulk writes will get 429'd by Notion
- **Pixabay / Jamendo quotas** — daily limits on free tiers

---

## Expected Behavior

Rate limits must be **enforced globally across all instances**, not per-container. A user who has used their daily upload quota on one request should be blocked on all subsequent requests regardless of which Vercel instance handles them.

---

## Proposed Fix

Replace the in-memory `Map` with a **persistent atomic counter**. Recommended options (pick one):

### Option A — Vercel KV (Upstash Redis, zero-config on Vercel)
```ts
import { kv } from '@vercel/kv';

export async function checkRateLimit(email: string, action: string, limit: number, windowMs = 86400000) {
  const key = `rl:${email}:${action}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.pexpire(key, windowMs);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
```

### Option B — Upstash Redis directly (if not using Vercel KV)
Same pattern using `@upstash/redis`.

### Option C — Simple DB-backed counter (if Redis feels like overkill)
Use Notion itself or a lightweight SQLite via Turso/Cloudflare D1.

---

## Scope of Changes

- [ ] Add `@vercel/kv` (or `@upstash/redis`) dependency
- [ ] Rewrite `src/lib/rate-limit.ts` to use async Redis-backed counter
- [ ] Update all callers to `await checkRateLimit(...)` (currently sync)
- [ ] Add `REDIS_URL` / `KV_*` env vars to `.env.sample` and Vercel project settings
- [ ] Verify Demo user limits are still enforced (demo@lovely-shelf.com → stricter limits)
- [ ] Add integration test: simulate limit exhaustion across "two instances"

---

## Notes

- Current limits hardcoded: real users 20 uploads/day, demo users 10 uploads/day — keep these values, just make them actually work
- The `/api/chat` SSE endpoint also hits Claude on every message; consider a separate per-minute limit (e.g. 20 messages/min) in addition to the daily cap
- `windowMs` reset logic must use Redis TTL, not a JS `Date.now()` comparison, to avoid clock skew between instances
