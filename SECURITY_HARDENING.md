# Security hardening programme — 2026-08-17/18

Companion to `SECURITY_AUDIT.md`, which covered rate-limit coverage, a
`hashedKey` leak and multi-account abuse. This one covers the items requested
afterwards: DDoS/spoofing, RLS, front-end vs server permissions, SQL injection,
session storage, upload validation, encryption, field tampering, bot protection,
input validation, response trimming, security headers and dependency scanning.

The point of writing it down is that **most of this list was already handled**,
and re-auditing it from scratch next quarter would be wasted effort. Where the
answer is "already fine", the evidence is here so it can be checked rather than
re-derived.

---

## Fixed in this programme

| Item | What was wrong | Where |
|---|---|---|
| **IP spoofing** | `clientKey()` read the *leftmost* `x-forwarded-for` entry — the part a client fully controls. Sending `X-Forwarded-For: <random>` minted a fresh rate-limit key per request and defeated every IP-keyed limit in the app. | `src/lib/rateLimit.ts` |
| **Upload validation** | The three image routes trusted `file.type`, which is the client's claim about the bytes. Arbitrary content could be stored under an image label in a public bucket served from our own domain. | `src/lib/uploadValidation.ts` |
| **Row Level Security** | Not enabled anywhere. Supabase hands every browser a publishable key that reaches PostgREST as `anon`/`authenticated`; nothing stood between those roles and the tables. | `prisma/migrations/20260818000000_enable_row_level_security` |
| **Bot protection** | None. Signup and login call Supabase directly from the browser, so this app's limiter never sees them. | `src/lib/turnstile.ts`, `src/components/Turnstile.tsx` |

### RLS: what it does and does not do

Deny-by-default, **no policies**, on all 55 tables. RLS with no permissive
policy denies every row to any role that is neither the table owner nor holding
`BYPASSRLS`.

This does **not** move authorization into the database. Doing that properly
means running app queries on a per-user connection, which is a rewrite of the
data layer. The application remains the trust boundary, exactly as
`src/lib/prisma.ts` documents.

`FORCE ROW LEVEL SECURITY` is deliberately **not** set — forcing it would lock
out the very connection the app runs on.

Verified against a real Postgres: 55/55 tables report `rowsecurity`, zero
policies, and with a row present the owning role reads it while a separate role
holding `GRANT SELECT ON ALL TABLES` reads nothing (`OWNER_SEES=1`,
`PROBE_SEES=0`).

### Turnstile: only half of it is code

For **signup and login**, the token goes to Supabase and *Supabase* verifies
it — which happens only once CAPTCHA is enabled in the project's Auth settings
with the matching secret. A token passed to a project with it switched off is
silently ignored. For **our own routes** (waitlist), verification happens in
`src/lib/turnstile.ts` against Cloudflare directly.

Fails closed when a secret is configured, skips entirely when one is not.

---

## Already correct — checked, no change needed

**Server-side auth.** All 93 API routes are either guarded
(`requireUser`/`requireConsumer`/`requireAdmin`/`requireApiKey`/`requireOwnProvider`/
`requireOwnCorporateOrg`/`requireRegulator*`/`verifyCronRequest`/`verifyPaynowHash`)
or intentionally public (`health`, `health/ready`, `fx-rates`, `facts`) or
public-and-rate-limited (`waitlist`, `need-intake`, `traditional-comparison`).
Front-end gating exists for UX, but every check is repeated server-side — the
client is never the enforcement point.

**SQL injection.** Prisma parameterises everything. The only raw SQL is
`src/lib/ai/usage.ts`'s `$queryRaw`, which uses tagged templates — values are
parameterised, not concatenated.

**Session storage.** Auth is **not** in `localStorage`. `@supabase/ssr`'s
`createBrowserClient` is cookie-based, and `src/proxy.ts` handles the cookie
lifecycle server-side. Web storage is used only for theme (`localStorage`) and
UTM capture / compare tray / chat handoff (`sessionStorage`) — none of it
credentials. Cookie flags are set by Supabase, and the session cookie is
`httpOnly`, so client JavaScript cannot read it.

**Field tampering / mass assignment.** No route assigns unvalidated client
input to a model. 92 of 93 routes parse the body with a zod schema, and
`z.object()` strips unknown keys by default — so an attacker adding `role`,
`isAdmin` or `walletBalanceUsd` to a payload gets them dropped before the
value reaches Prisma. The remaining route
(`/api/notifications/preferences`) validates manually against an allowlist and
a `typeof` check, then passes explicit arguments rather than a spread.

**Input validation.** Same 92/93 zod coverage. Bounded JSON records
(`boundedJsonRecord`) exist for the two free-form `Json` columns so they cannot
be used for write amplification.

**Security headers.** Nonce-based CSP with `strict-dynamic` — no
`'unsafe-inline'` in `script-src` — plus HSTS, `X-Frame-Options: DENY`,
`nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP and CORP. Since the
proxy matcher was widened these reach every page, including `/`, `/login` and
`/signup`. Verified live: `e2e/seo-and-headers.spec.ts` passes.

**Dependency scanning.** Trivy scans the image on every PR and gates on fixable
CRITICALs; Trivy also policy-scans the rendered Helm manifests; Dependabot
raises grouped update PRs. Current state: no critical library vulnerabilities
(`npm audit`), three HIGH in `deepmerge-ts` via the Prisma CLI — a dev
dependency, not shipped.

**Response trimming.** User-scoped responses use `privateJson`, which sets
`no-store` and `Vary: Cookie`. The one field-level leak (`hashedKey` on the
admin API-keys route) was found and fixed in `SECURITY_AUDIT.md`, with a
regression test asserting the field is never even *requested* from Prisma.

---

## Encryption: deliberate decision to add none

Supabase encrypts at rest and TLS covers transit. Application-level column
encryption was considered and **rejected**, because this app stores nothing
that warrants it and it would break more than it protects:

- **No card data.** Paynow holds it; we store a reference and an amount.
- **No national IDs, no health records.** The health *sector* is a comparison
  category, not patient data.
- **Emails must be queryable** — login and the waitlist unique constraint both
  depend on lookup. Encrypting them requires a blind index to work at all.
- **Wallet amounts must be summable and sortable** for reporting and admin
  views; the Paynow webhook depends on looking a transaction up by reference.

Secrets that *are* sensitive are already handled: BI API keys are stored as
sha256 hashes and never returned after creation, and third-party credentials
live in environment variables sourced from the cluster's `ExternalSecret`,
never in the database.

Revisit if the app ever stores government IDs, health records, or card data
directly.

---

## Known gaps, deliberately not closed here

- **Signup IP is not persisted.** `SECURITY_AUDIT.md` recommends it alongside
  CAPTCHA for ban-evasion flagging. Needs a schema change; worth its own
  migration.
- **Edge/WAF DDoS protection.** Everything here is application-level. A volumetric
  attack is absorbed upstream (Cloudflare/ingress), not by this code.
- **Two-step email verification** is a separate piece of work.
- **`TRUSTED_PROXY_COUNT` must match the deployment.** Default 1. Setting it
  too low is a spoofing bypass; too high only over-groups callers.
