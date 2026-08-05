# Kuwana session handoff — 2026-08-04/05

39 commits, one long unattended session. Written for a fresh Claude Code
session (or a human) picking this up cold. If you're an AI reading this:
read `README.md` first (it has its own, more granular "what changed"
log with commit-level detail) — this file is the higher-altitude map:
what's done, why, and what's genuinely left.

## The one-sentence version

Kuwana is a decision-intelligence platform (Need → Context → Eligible
Options → Total-Cost Comparison → Recommendation → Explanation → Action —
**explicitly not a price-comparison platform**, per its own design brief)
for Zimbabwe/Southern Africa, now a real 4-portal app — **Consumer,
Corporate, Regulator, Provider** — plus an **Admin** portal that oversees
all four. This session took it from "Consumer + stubs" to all four
portals actually working, fixed a live security vulnerability, added a
test suite from scratch (0 → 76 tests), and did a full production-
readiness pass (error handling, SEO, accessibility, security headers,
database indexing).

## Where the vision lives

- `E:\plan\KUWANA_MVP_BUILD_PLAN.md` — the authoritative build plan
  (supersedes the copy in `E:\documentation kuwana`, which is older).
- `E:\documentation kuwana\KUWANA_DECISION_INTELLIGENCE_PLAN.md` — the
  "decision intelligence, not comparison" framing, worth rereading before
  adding features that feel comparison-platform-shaped.
- The AI4I proposal (`Kuwana_AI4I_Proposal_Design.docx` / the PDF the
  project owner pasted into this session) — the original pitch, names
  the four personas (Consumer/SME/Regulator/Provider) and the mandatory
  WCAG 2.1 AA / no-invented-statistics constraints.
- `E:\new`, `E:\zim-compare-ui-redesign-2--main` (+ its "(9)" duplicate,
  confirmed byte-identical, not a v2 vs v2.5 diff) — older, more
  feature-rich prototypes. Good source of UX ideas (Netflix-row
  dashboard, price sparklines, a persistent compare tray) but built as an
  actual comparison/marketplace app — evaluate anything from there
  against the decision-intelligence framing before porting it.
- `E:\IntelliRevenue--2-dev`, `E:\BankMaster-3_1`,
  `E:\Fintech_Backend_MODULE_UPLOAD_UI_FIXED-1-main`,
  `E:\revenue-assurance-system-3-2_7` — the "initial banking idea" that
  seeded this project. Real fee/rate-comparison engines and data models
  for the banking sector specifically, none of it wired into this repo.
- `E:\inspo ui` — UI inspiration, mostly Zimbabwean apps (PriceLyst,
  EcoCash, Dial a Delivery) plus global ones (Takealot, SHEIN) and two
  whiteboard photos sketching the intended domain-module architecture.

## What actually changed this session

### Security (do not reopen these)
- **Closed a live role-escalation vulnerability**: `/api/onboarding`
  accepted `role: "corporate"|"regulator"` straight from an authenticated
  client with zero server-side check — any signed-up user could self-
  grant Corporate ("Market Intelligence") or Regulator ("Compliance &
  Market Monitoring") access, despite the signup UI's own copy claiming
  domain/verification requirements. Restricted to `role: "consumer"` only
  (`src/lib/onboardingSchema.ts`). This was the **only** self-service role.
  - **2026-08-05 update**: reopened deliberately, at the project owner's
    explicit request, with the missing server-side check actually built
    this time — see `src/lib/orgVerification.ts`. Corporate now requires
    a non-personal-email domain (blocklist); Regulator requires the
    authenticated email's domain to match one of a small curated
    allowlist (`REGULATORS`); Provider has no domain check by design (the
    informal-sector persona below has no company domain to check). Both
    checks key off `authUser.email` from the Supabase session, never the
    request body — that's what makes this different from the original
    hole. Admin was explicitly *not* reopened — it isn't a `Role` at all,
    stays the `ADMIN_EMAILS` allowlist, and was deliberately left off the
    signup role list. If you're re-reading this before touching
    `onboardingSchema.ts` or the signup role picker: the check is the
    point, don't strip it back to a bare role literal.
- Built `/admin/users` as **another legitimate way** to grant Corporate/
  Regulator/Provider (e.g. to fix a mis-set role, or hand-grant when
  automated verification doesn't fit) — no longer the *only* way after the
  above update, but still the only path for Admin-adjacent corrections.
- Closed a middleware gap: `/corporate`, `/regulator`, `/notifications`,
  `/provider` weren't in `proxy.ts`'s `PROTECTED_PREFIXES` — only page-
  level checks guarded them.
- Fixed a TOCTOU race in provider owner-linking
  (`/api/admin/providers/[id]`) — two concurrent link attempts could
  bypass the "already linked" check and hit a raw 500 instead of a
  friendly conflict.
- `ADMIN_EMAILS` was completely unset in `.env` — the admin login the
  project owner gave this session (`chindudzim@africau.edu`) would not
  have worked even after email confirmation. Fixed.
- Added baseline security headers (`next.config.ts`): X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS.
  **No CSP yet** — deliberately deferred, needs an inline-script/style
  audit first (see "Left for later" below).

### The Provider portal (built from scratch — the "4th" of the 4-in-1)
- Schema: `Listing.status` (draft/pending_review/published/rejected,
  default `published` so nothing existing changed behavior) and
  `Provider.ownerUserId` (nullable, unique — links one "provider" role
  account to the one Provider record it can self-manage). Migration
  applied via `prisma migrate diff --from-url ... --to-schema-datamodel`
  + hand-placed migration + `migrate deploy`, since `migrate dev` needs a
  TTY this environment doesn't have (still true — see below).
- Every consumer-facing listing read now filters `status: "published"` —
  traced and fixed all 12 `prisma.listing.find*` call sites in the repo.
- **`/provider` is deliberately not a standard web form.** Built as a
  guided, one-question-per-screen wizard (sector → category → name →
  price → one attribute per screen → plain-language review → send) —
  this was an explicit redirect from the project owner: the real target
  user is an informal-sector provider (a kiosk operator, a small
  insurance agent) with no website, no social media, possibly limited
  reading comfort, who uses WhatsApp/EcoCash daily but has never filled
  out a business web form. No JSON, no dropdowns, big tap targets, one
  obvious action per screen.
- Admin review queue: `/admin/catalog` now has a "Needs review" filter
  pill with a live count, and Approve/Reject actions (reject requires a
  reason the provider sees on their own `/provider` page).
- A provider can only ever submit as `draft`/`pending_review` (enforced
  in the zod schema, not just the route) — never self-publish or self-
  reject. Can edit while draft/pending_review/rejected; **cannot edit a
  published listing** through this route (deliberate scope boundary — see
  below, this is real remaining work).

### Decision-intelligence core (the actual product thesis)
- Added eligibility/requirement surfacing: `src/lib/eligibility.ts`
  distinguishes a listing's hard requirements (currently just
  `min_balance`, the only such field actually seeded) from its ordinary
  comparable specs, surfaced as a "To qualify" callout in the compare
  view, listing detail, browse grid, and fed into the AI recommendation
  prompt. Deliberately does **not** try to infer personal affordability
  against a user's footprint (onboarding only captures a spend *range*,
  not income — comparing that to a lump-sum balance requirement isn't a
  sound inference, and building it anyway would be exactly the kind of
  invented statistic the design brief forbids).
- Need-intake (plain-language "what do you need") now leads the
  dashboard too, not just `/explore` — need-first over catalogue-first.
- Corporate/Regulator got the design brief's missing stages: a sector
  filter (Explore/drill-down), Key Insights, and Recommended Actions —
  all templated directly from the existing `getMarketOverview()` rollup,
  never a separately invented figure.

### Testing (0 → 76 tests, Vitest didn't exist before this session)
Covers: `computeDecisionScores`, the eligibility helpers, price trend/
forecast math, XP/level math, the full gamification engine
(`recordEvent` — XP, streaks, badges, quest progress, via an in-memory
fake transaction client, not real Prisma), `requireConsumer`/
`requireAdmin`/`requireOwnProvider` auth guards (mocked Supabase/Prisma),
and every new zod schema (onboarding role restriction, admin role
assignment, provider listing creation/update).

### Production readiness
- Bumped Next.js 16.2.12 → 16.3.0 (a minor bump, not the major one
  initially assumed) — fixed 3 real high-severity CVEs in bundled
  postcss/sharp. `npm audit` now reports 0 vulnerabilities.
- Added `error.tsx`/`not-found.tsx`/`global-error.tsx` — none existed;
  any unhandled exception fell through to Next's generic framework page.
- Added `loading.tsx` to every data-fetching route (dashboard, corporate,
  regulator, provider, chat, notifications, profile, explore/[sector] +
  compare, listing/[id], admin + catalog) — none existed; every page
  showed a blank screen during its server round-trip.
- Added the full SEO layer: `robots.ts` (disallows every authenticated
  route), `sitemap.ts` (enumerates live sectors + published listings —
  95 URLs against current seed data), and per-page metadata (all 23
  pages previously shared one title/description).
- Fixed accessibility: every `<input>`/`<select>` in the admin/provider
  components this session added was missing the 44×44px touch-target
  class (the shared `Button` component already had it baked in, native
  form elements don't inherit that). Also directly calculated contrast
  ratios for the `text-muted` token (4.83:1 light, 5.66:1 dark — both
  clear the 4.5:1 AA minimum) rather than assuming.
- **Fixed a live, currently-active bug**: `/api/recommendations` had no
  error handling around the Anthropic call. Confirmed by calling the
  client directly with the project's actual placeholder key — it throws
  `AuthenticationError` every single time, meaning every real "Get AI
  recommendation" click was silently failing (no error shown, button
  just reverts) until this fix. Now shows a real error message.
- **Caught and avoided a destructive migration**: went to add 3 obvious
  database indexes, and the generated diff proposed *dropping 15 indexes*
  that already existed in the live database but weren't in the tracked
  `schema.prisma` — someone had applied a genuinely sophisticated
  indexing strategy directly to the database (GIN index for an array-
  containment query, DESC ordering matched to real query directions)
  that had never been captured in the schema file. Re-derived the full
  set from `pg_indexes` and wrote it into `schema.prisma` accurately;
  re-running the diff now returns empty. **Lesson for next session: this
  schema has been touched by more than one hand — always check what
  `migrate diff` actually proposes before running it, don't trust it
  blindly even when it looks like a small change.**
- Fact-checked `onboarding-facts.ts`'s historical trivia via web search —
  found and fixed 5 real inaccuracies (Econet wasn't first to launch,
  wrong founding years for Nedbank/Stanbic, a false "oldest medical aid
  society" claim, an uncorroborated CBZ contactless-cards claim).
- `/admin` is now a real dashboard (user counts by role, listing counts
  by status, provider-linkage count) instead of three bare links — the
  point of an admin overview for a 4-portal app is answering "how is each
  one doing" at a glance.

## Left for a future session

### The one blocker only the account holder can clear
- **`ANTHROPIC_API_KEY` is still a 10-character placeholder.** `/api/chat`
  and `/api/recommendations` cannot work end-to-end until a real key is
  set. Everything downstream of this (the AI recommendation UX, the chat
  assistant) is otherwise fully built and tested — this is genuinely the
  single highest-leverage remaining item.

### Real product/design decisions (don't just pick one — ask)
- **Three disagreeing color palettes exist**: the shipped one
  (`globals.css`, sky/teal/coral, used in ~40 files), an all-blue "v2" in
  an external `tokens.css` (`E:\plan`), and a third navy/gold in a
  reference PNG. Left the shipped one alone — no clear signal which is
  actually current, and a mass find-and-replace with no sign-off is
  wasted work at best.
- **9 sectors are seeded "live"** (telecom, banking, insurance, education,
  transport, utilities, pharmacy, electronics, fashion) vs. the original
  4-sector MVP scope. Left as-is (real seeded work, no reason to roll it
  back), but Transport/Utilities/Pharmacy are noticeably thinner (3-4
  listings each vs. 9-16 for the core four) — that's honest reflection of
  real data coverage, not padded with invented listings, and it's a
  product call whether/how to grow them.
- **i18n (Shona/Ndebele)** — flagged repeatedly in research as a real
  differentiator the older prototypes had. Deliberately not attempted:
  generating translations without a native speaker to validate them
  risks shipping *wrong* Shona/Ndebele, which is worse than not having it.
  If tackled, get a real translator in the loop, don't have an LLM
  generate and ship translations unsupervised.

### Provider portal — real gaps, not just "more features"
- **A provider cannot edit a published listing at all** through
  `/provider` — deliberate scope boundary this session drew (editing
  live, consumer-facing data without going through review would defeat
  the point of the review workflow), but it means once approved, a price
  change requires... nothing currently. This needs a real "propose an
  edit, goes back to pending_review" flow — a genuine next feature, not
  a bug.
- ~~No delete capability for providers~~ **closed 2026-08-05**: a
  provider can now delete their own draft/pending_review/rejected
  listings (`DELETE /api/provider/listings/[id]`); published stays
  admin-only, same boundary the PATCH route already drew.
- ~~No notification to a provider when their submission is approved/
  rejected~~ **closed 2026-08-05**: `notifyListingDecision`
  (`src/lib/notifications.ts`) creates an in-app Notification row on
  admin approve/reject, reusing the existing price-drop notification
  system (`/notifications`, now open to provider accounts too via
  `requireConsumerOrProvider`).
- No provider-facing analytics (views, times shown in a comparison,
  etc.) — `getAlsoCompared`'s co-occurrence data exists in `Comparison`
  rows already; could be surfaced per-provider without new tracking.

### Corporate/Regulator — intentionally left thin
Per the build plan itself ("backlog, not current scope" for the fuller
4-portal build), this session prioritized Consumer decision-intelligence
depth and getting Provider to exist at all over Corporate/Regulator
depth. Real gaps if that changes:
- No dedicated Corporate/Regulator onboarding — both roles only reachable
  via `/admin/users`, no invite-flow UI (e.g. emailing a magic link).
- No org/seat/multi-user model for Corporate — schema has no
  `Organization`/`OrgMember` concept, so "Corporate" is currently just a
  single user account with a role flag, not a team.
- No audit log for Regulator (compliance/audit-trail features from the
  build plan's Section 14 aren't started).
- No procurement-specific features (downloadable evidence, shortlist
  comparison reports) mentioned in the AI4I proposal's SME persona.

### Admin — solid but not complete
- Admin auth is still an email allowlist (`ADMIN_EMAILS`), not a real
  role with granular permissions — fine for one admin, would need
  rethinking for multiple admins with different scopes.
- No audit log of admin actions (who approved/rejected what, who linked
  which provider to which user).
- No error-tracking/monitoring service wired up (Sentry, etc.) —
  `console.error` is the only signal right now for both the new
  `error.tsx` boundary and the recommendations failure handling.

### Infrastructure / cross-cutting
- **No CSP (Content-Security-Policy) header** — deliberately deferred;
  needs an audit of every inline style/script first (SVG components, the
  `theme-init` `next/script` snippet in `layout.tsx`) to avoid breaking
  something.
- **No rate limiting** on public unauthenticated endpoints (`/api/
  waitlist`, `/api/need-intake`) — no Redis/Upstash infra exists to build
  this properly; would need a real infra decision, not a unilateral add.
- `migrate dev` still needs a TTY this environment doesn't have — the
  established workaround (documented in commit messages) is:
  ```
  prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > migration.sql
  ```
  then hand-place the SQL into a timestamped `prisma/migrations/<ts>_name/`
  folder and run `prisma migrate deploy`. **Always read the generated SQL
  before applying it** — see the index-drift incident above.
- No E2E/browser test coverage (Playwright etc.) — only unit tests via
  Vitest. Every UI verification this session was done via `curl`/manual
  DB queries against the real dev database, not a real browser.
- Payment integration (Paynow/Pesepay/Flutterwave, named in the older
  prototypes as a "standout feature") — not started, needs real merchant
  credentials for each provider, a genuine infra/business decision.

## Working conventions this session established (keep following these)

- **Every change verified**: `tsc --noEmit`, `eslint .`, `vitest run`
  (now 76 tests), and a full `next build` before every commit. Runtime-
  smoke-tested against the real dev database wherever practical (this
  repo's `.env` has real, working Supabase credentials) rather than
  trusting a build/type-check alone.
- **Dev server discipline**: the project owner asked early on to keep the
  app stopped when not actively verifying something. Start it, test,
  stop it, verify via `Get-CimInstance`/`Get-NetTCPConnection` that
  nothing is left running — don't just assume a kill command worked.
- **Never fabricate data**: every "illustrative" number in the catalog is
  disclosed as mock/seed data (see README), but anything presented as a
  *computed insight* (decision scores, market overview stats, admin
  dashboard counts) must trace to a real query — verified directly
  against the database, not just code-reviewed, multiple times this
  session (the admin dashboard stats, the sitemap listing count, the
  eligibility surfacing).
- **This repo has a second author working in parallel** (branding/icon
  work, a `Header.tsx`/`PageTransition` positioning fix, the DIRECT_URL/
  Supavisor pooler switch). Their uncommitted files were repeatedly
  swept up by broad `git add -A` and had to be unstaged before each
  commit — check `git status` carefully, don't blindly `git add -A`.
