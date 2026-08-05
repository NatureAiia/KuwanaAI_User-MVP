# Kuwana — MVP

Multi-sector, AI-assisted comparison platform for Zimbabwe/Southern Africa (telecom, banking,
insurance, education — Healthcare shown as "coming soon"). See `KUWANA_MVP_BUILD_PLAN.md` for the
full product/architecture spec this build follows.

## Stack

Next.js (App Router) + Tailwind CSS v4 · PostgreSQL + Prisma · Supabase Auth · Claude API
(server-side only) · Vercel-ready.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — a Postgres connection string (Supabase or Neon)
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` —
     from your Supabase project settings
   - `ANTHROPIC_API_KEY` — for AI recommendations

   > **Supabase project setting:** for the frictionless onboarding flow described in the build
   > plan (signup → footprint → consent → save profile, no interruption), disable email
   > confirmation in your Supabase Auth settings, or the user will need to confirm their email
   > before `/api/onboarding` can attach their profile.

3. **Run migrations and seed data**

   ```bash
   npx prisma migrate dev
   npm run db:seed
   ```

   This seeds all 4 live sectors (Telecom, Banking, Insurance, Education) with categories,
   attribute schemas, providers, and realistic mock listings, plus the gamification rules,
   badges, and an initial weekly quest. Listing data is illustrative/mock, not live provider data
   (per MVP scope).

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Project structure

- `prisma/schema.prisma` — full data model (identity/onboarding, sector catalog, comparison
  activity, gamification)
- `prisma/seed.ts` — seed script for sectors/categories/attribute schemas/providers/listings
- `src/app/` — routes (public landing/login/signup, authenticated dashboard/explore/profile/etc.,
  API routes under `src/app/api/`)
- `src/lib/gamification/` — the event-driven gamification engine (XP, levels, streaks, badges,
  quests), processed synchronously per request
- `src/lib/catalog.ts`, `src/lib/scoring.ts` — schema-driven catalog reads and the value-score
  heuristic used across Explore/Compare/Dashboard
- `src/components/SignalBloom.tsx` — the signature radial arc meter (value score / XP / AI
  confidence)
- `src/middleware.ts` → `src/proxy.ts` — Supabase session refresh + auth gating for
  `/dashboard`, `/profile`, `/leaderboard`, `/settings` (Explore/listings stay public per the
  "browse now, sign up to act" flow)

## Notes / assumptions

- Consumer role only for this MVP; `role` field and schema support Corporate/Regulator/Provider
  for later.
- No background job queue — gamification processing runs in the same transaction as the
  triggering request.
- Leaderboard is opt-in only and always shows a nickname, never a real name.
- All comparison data is mock/seed data, clearly out of scope for live scraping/provider
  integrations at this stage.

## Design brief: decision intelligence, not comparison

Kuwana's own design brief (`Kuwana_AI4I_Proposal_Design`) is explicit that this is **not** a
price-comparison or e-commerce platform — it's a decision-intelligence system following
**Need → Context → Eligible Options → Total-Cost Comparison → Recommendation → Explanation →
Action**, with hard constraints: every recommendation must be explainable, eligibility-aware,
and traceable to real data (no invented statistics, no recommendation when data is insufficient).
Keep this in mind before adding "comparison platform" UX patterns (compare-trays, checkout
simulations, gimmicky AI-chat bolt-ons) ported from earlier prototypes — evaluate them against
this brief first.

## 2026-08 session: what changed and what's deliberately deferred

A single unattended session made the following changes, prioritized around strengthening the
decision-intelligence core over porting more comparison-platform features from older prototypes:

**Fixed:**

- **Security:** `/api/onboarding` accepted `role: "corporate" | "regulator"` straight from the
  client with no server-side check, despite the signup UI's own copy claiming domain/verification
  requirements for those options — any signed-up user could self-grant Corporate ("Market
  Intelligence") or Regulator ("Compliance & Market Monitoring") access. Restricted the schema
  (`src/lib/onboardingSchema.ts`) to `role: "consumer"` only, matching the build plan's own stated
  design (those roles are admin-invited, never self-registered); removed the now-nonfunctional
  Regulator/Corporate cards from the signup role picker. Checked the live DB first — only one
  existing user, so this broke nothing real. Added `/admin/users` as the legitimate replacement —
  the only remaining way to grant Corporate/Regulator/Provider, gated by `requireAdmin()`.
- `proxy.ts` middleware wasn't guarding `/corporate`, `/regulator`, `/notifications` at the edge
  (only page-level `requireUser()` checks did) — added to `PROTECTED_PREFIXES`.
- `ADMIN_EMAILS` was entirely unset in `.env`, so the admin account had no way to pass
  `requireAdmin()` even once its email was confirmed. Added `.env.example` (referenced by this
  README but missing).
- Added `CRON_SECRET` and wired `refresh:freshness` / `rotate:quests` / `refresh:fx` (previously
  manual-only scripts) to Vercel Cron via `src/app/api/cron/*` + `vercel.json` (conservative
  once-daily schedule — safe on Vercel's Hobby tier; `fx-refresh` could move to a shorter
  interval on a paid plan).

**Added (decision-intelligence core):**

- `src/lib/eligibility.ts` — surfaces a listing's real requirement attributes (e.g. `min_balance`)
  as a distinct "To qualify" signal in the compare view and the AI recommendation prompt,
  answering the brief's "Eligible Options" stage. Deliberately does **not** attempt to infer
  personal affordability against a user's footprint — onboarding only captures a monthly-spend
  *range*, not income/savings, and comparing that to a lump-sum balance requirement isn't a sound
  inference; building it anyway would be exactly the kind of invented statistic the brief forbids.
- `NeedIntake` (already built for `/explore`) now also leads the dashboard, so a returning user's
  first move is expressing a need in plain language, not browsing a sector grid.
- `/admin/catalog` — the admin listings/providers API existed with no UI at all (hand-editing
  `prisma/seed.ts` was the only path). Added list/edit/delete for listings and create forms for
  both listings and providers, over the existing API routes.
- `/corporate` and `/regulator` — both stopped at a raw "Overview" data dump. Added the brief's
  remaining stages: a sector filter (Explore/drill-down), a Key Insights section, and a
  Recommended Actions section, all templated directly from `getMarketOverview()`'s existing
  rollup — never a separately invented figure.
- Vitest + 27 tests over `computeDecisionScores`, the new eligibility helpers,
  `computePriceTrend`/`computePriceForecast`, and XP/level math — there was no test framework at
  all beforehand, and this is a regression net for the highest-stakes pure logic.

**Deliberately deferred (flagging for a real decision, not silently done):**

- **`ANTHROPIC_API_KEY` is still a placeholder** (10 chars) — `/api/chat` and
  `/api/recommendations` will fail end-to-end until a real key is set. This is the single highest-
  leverage remaining blocker and isn't something that can be resolved without the account holder.
- **Three disagreeing color palettes exist** (`src/app/globals.css`'s shipped
  sky/teal/coral, an all-blue "v2" in an external `tokens.css`, and a third navy/gold in a
  reference PNG). Left the shipped palette alone rather than a mass find-and-replace across ~40
  files with no product sign-off on which is current.
- **9 sectors are seeded "live"** (beyond the original 4-sector MVP scope). Left as-is rather than
  rolling back real seeded work — worth an explicit product conversation, not a unilateral scope
  cut.
- **Corporate/Regulator portals stay intentionally thin** relative to the older
  `zim-compare-ui-redesign` prototype's full 13-vertical, four-portal build — that breadth is
  explicitly "backlog, not current scope" per the build plan. (Provider now has a real,
  purpose-built portal — see below — since it needed to exist at all for the role to mean
  anything, not because it needed the same depth as Corporate/Regulator.)
- **`process-event.ts` gamification-engine tests weren't added** — it takes a live Prisma
  transaction client and mocking a multi-step `tx.*` interaction properly is a separate, larger
  piece of work than this pass covers. (`requireConsumer`/`requireAdmin` *are* now covered, with
  mocked Supabase/Prisma — see `src/lib/auth.test.ts`.)
- **`onboarding-facts.ts`'s historical trivia** (provider founding dates, membership counts) is
  unsourced/unverified by this session — worth a fact-check pass since the brief's "no invented
  statistics" bar arguably extends to onboarding copy, not just computed recommendations.
- **A `next`/`postcss`/`sharp` transitive dependency audit warning** (3 high-severity, fixed only
  by bumping `next` to 16.3.0, outside the currently pinned range) — a framework version bump is
  a deliberate call for someone to make, not a silent side effect of a session.

## 2026-08-05 continuation: role security fix + the Provider portal

A second pass, continuing from the same session.

**Security fix:** `/api/onboarding` accepted `role: "corporate" | "regulator"` straight from the
client with zero server-side check, despite the signup UI's own copy claiming domain/verification
requirements — any signed-up user could self-grant Corporate ("Market Intelligence") or Regulator
("Compliance & Market Monitoring") access. Restricted to `role: "consumer"` only
(`src/lib/onboardingSchema.ts`), matching the build plan's "admin-invited only" design. Checked the
live DB first (one existing user) — broke nothing real. This is exactly why questions worth asking
get asked before automating further: closing it also made Corporate/Regulator/Provider
unreachable by any legitimate path, so `/admin/users` (role assignment) had to be built as the
replacement in the same pass.

**The Provider portal** (build plan 15.2, "the 5th interface") went from schema-only to fully
working:

- **Schema**: `Listing.status` (draft/pending_review/published/rejected, default `published` so
  every existing listing keeps behaving exactly as before) and `Provider.ownerUserId` (nullable,
  unique — links a "provider" role account to the one Provider record it can self-manage).
  Applied via `prisma migrate diff --from-url ... --to-schema-datamodel`, a hand-placed migration
  file, then `migrate deploy`, since `migrate dev` needs a TTY this environment doesn't have.
- **Every consumer-facing listing read now filters `status: "published"`** — catalog.ts's three
  read functions, the listing detail page, `/api/chat`'s grounding queries, `/api/recommendations`,
  `/api/saved`. Verified end to end against the live DB with a throwaway listing: invisible while
  pending, visible once published.
- **`/admin/catalog`** gained a Providers table with email-based owner linking (an admin knows a
  contact's email, not their internal user id), a listing Status column, and a "Needs review"
  filter pill with a live count — without it, a pending listing is a needle in however many
  listings exist.
- **`/provider`**: deliberately *not* a standard web form. The intended user may have no website,
  no social media, and limited reading comfort — someone who uses WhatsApp/EcoCash daily but has
  never filled out a business form online. It's a guided, one-question-per-screen wizard (sector →
  category → name → price → one attribute per screen → plain-language review → send), all big tap
  targets and plain words, no JSON, no dropdowns, ending on one obvious action low on the screen.
  Only reachable once an admin links the account to a Provider record via `/admin/catalog`.
- Every route added is covered by a mocked-auth test (`providerAuth.test.ts`,
  `providerListingSchema.test.ts`) proving a provider account can only ever act on its own linked
  Provider and can never self-assign `published`/`rejected`.

Also fixed in passing: the "you can change this later in settings" line in the signup role picker
was inaccurate (no such control exists) — removed rather than left misleading.
