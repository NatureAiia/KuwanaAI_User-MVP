# Security & resilience audit — 2026-08-17

Branch: `security/resilience-audit`, based on `origin/main` at `36899a8`. Defensive,
authorized self-audit of this repo — traffic/DoS resilience, general auth/security
holes, and multi-account abuse — requested to find and fix real weaknesses before
they're found in production. Method: three independent research passes (one per
area) grepping every route handler against the patterns each class of bug actually
takes in this codebase, followed by targeted fixes and PoC scripts under
`scripts/security-poc/` that exercise the real code paths (no external network
calls, no live attacks against any deployment).

**Overall shape found:** the codebase was already in good condition — most
ownership checks, the Paynow webhook's hash verification, and the rate-limit
module itself are all correctly built. The gaps were almost entirely "the pattern
exists, wasn't applied everywhere it should be," not missing infrastructure.

## Fixed on this branch

### Traffic / DoS resilience

`enforceRateLimit()` (`src/lib/rateLimit.ts`) existed but was applied in only ~11
of ~85 route files — it's opt-in per route, so anything that forgot to call it got
no protection at all. Added it to:

| Route | Key | Budget |
|---|---|---|
| `POST /api/events` | `events:${userId}` | `authedWrite` (60/min) |
| `POST /api/corporate/listings/bulk-price-update` | `bulk-price-update:${providerId}` | `authedWrite` |
| `POST /api/provider/listings/images` | `listing-image-upload:${providerId}` | new `mediaUpload` (10/min) |
| `POST /api/admin/listings/images`, `/api/admin/adverts/images` | `admin-*-image-upload:${adminId}` | `mediaUpload` |
| `POST /api/complaints` | `complaints:${userId}` | `authedWrite` |
| `POST`/`DELETE /api/saved` | `saved:${userId}` | `authedWrite` |
| `POST /api/pins` | `pins:${userId}` | `authedWrite` |
| `POST /api/onboarding` | `onboarding:${userId}` | `authedWrite` |
| `POST /api/corporate/requests` | `corporate-requests:${providerId}` | `authedWrite` |
| `POST /api/corporate/alert-rules` | `corporate-alert-rules:${providerId}` | `authedWrite` |

Also:
- **`/api/events`'s `metadata` field** was an unbounded `z.record(string, unknown())`
  — a free write-amplification primitive into a Json column (the same class of bug
  `boundedJsonRecord` was already added for `/api/footprint`). Swapped to
  `boundedJsonRecord(40, 8_000)`.
- **`/api/corporate/listings/bulk-price-update`** ran a fully sequential loop —
  up to 200 rows × ~4 sequential `await`s each — holding one request's DB
  connection open the whole time. Batched into groups of 10 processed
  concurrently (`Promise.all` per batch), same total work, far less time holding
  the connection.
- **`/api/chat/threads`, `/api/pins`, the sensitive GET branch of `/api/chat`**
  used `NextResponse.json` instead of the app's `privateJson` convention, which
  sets `Cache-Control: no-store` — standardized so per-user data can't end up
  behind a shared/CDN cache.

Verified live with `scripts/security-poc/verify-rate-limit-fixes.ts` — hammers the
exact keys these routes now call and confirms each blocks at its documented limit
(all 10 pass).

**Not fixed / lower priority, left as-is:**
- `need-intake`'s inline rate-limit object (works, just not folded into the named
  `RATE_LIMITS` convention — cosmetic).
- `/api/facts` — unauthenticated, but its one external call is behind a 10-minute
  cache regardless of request volume.
- `/api/admin/scrape-search` — calls a paid external API per request, but is
  `requireAdmin`-gated (insider-only); flagged for anyone who touches it next
  to add a budget-class rate limit given it spends real money per call.

### Auth / security holes

- **`PATCH /api/admin/api-keys/[id]` leaked `hashedKey`** — the sibling `GET` in
  `api-keys/route.ts` already scoped its `select` to exclude it; this route's
  `findUnique`/`update` fetched (and returned) the full row. Fixed to use the same
  explicit `select`. Regression test:
  `src/app/api/admin/api-keys/[id]/route.test.ts` (asserts the field is absent
  from the response **and** was never asked for in the Prisma call, so a future
  schema addition can't silently reintroduce it).
- **Followed up on `src/lib/ai/usage.ts`'s `$queryRaw` calls** (flagged by the
  audit as unaudited) — every interpolated value (`${since}`) goes through
  Prisma's tagged-template auto-parameterization, not string concatenation.
  Confirmed safe, no change needed.

**Verified clean, no fix needed (spot-checked, listed so this doesn't get
re-audited from scratch next time):** every dynamic `[id]` route under
`provider/`, `corporate/`, `notifications/`, `wallet/` correctly scopes its query
to the authenticated owner; every `admin/**` route calls `requireAdmin()`; the
Paynow webhook verifies the hash (constant-time comparison) *before* any DB
mutation and fails closed; `pollTransactionStatus` has a Paynow-host allowlist
guarding the one place a stored URL gets fetched server-side.

### Multi-account abuse — investigated, **not code-fixed on this branch**

Three real, compounding gaps exist, demonstrated live against current source by
`scripts/security-poc/multi-account-abuse-demo.ts`:

1. **No correlatable signal on `User` at all** (no IP, device ID, or phone stored
   at signup) — a suspended account has zero barrier to the same person signing
   up again immediately with a new email. The ban only ever blocks one string.
2. **Signup bypasses this app's rate limiter entirely** — `src/app/signup/page.tsx`
   calls `supabase.auth.signUp()` directly from the client, never touching
   `src/lib/rateLimit.ts`. Throttling is whatever Supabase's own Auth API
   enforces, which this codebase has no visibility into or control over.
3. **Per-account rate limits are trivially bypassed by spreading load across
   accounts** — a farm of N cheaply-created accounts gets N× any per-user budget
   in aggregate. The wallet top-up secondary IP-keyed limit added above (traffic
   section) closes the highest-value instance of this; the gamification-writing
   routes (`events`, `saved`, `comparisons`, `footprint`) are left per-user only,
   since a real fix here is closing #1/#2, not adding more rate-limit keys.

**Why these are deferred rather than patched:** the audit's own framing was
"pragmatic MVP fix vs. ideal fix," and both real options need a decision this
session can't make unilaterally — add a CAPTCHA to Supabase Auth's `signUp()`
call (`options: { captchaToken }`, Supabase supports Turnstile/hCaptcha natively)
and persist signup IP for soft ban-evasion flagging (pragmatic), versus phone/
device-verification infrastructure (ideal, real cost). No signup bonus or
referral system exists today to farm (checked — zero matches for "referral" in
`src/`), so the immediate exploitable damage is bounded to XP/badge farming and
ban evasion, not payment fraud; the wallet-endpoint fix above is the one
multi-account mitigation that couldn't wait on that decision.

## Recommended next step

Pick CAPTCHA-on-signup + persisted signup IP as the pragmatic fix for the
deferred multi-account findings, since it's mostly configuration against
infrastructure (Supabase Auth) that already exists, rather than new build.
