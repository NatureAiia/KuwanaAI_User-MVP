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
   - `LLAMA_VISION_BASE_URL` / `LLAMA_VISION_MODEL` — for AI recommendations and chat
     (default `http://localhost:11434` / `llama3.2-vision`, matching a local Ollama install;
     see the 2026-08-09 entry below for setup)

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

## Running it in a container

```bash
cp .env.example .env          # Supabase + Anthropic values
docker compose up --build     # postgres → migrations → app on :3000
docker compose --profile seed up seed
```

Kubernetes deployment (Helm chart, HPA, migrations-as-a-hook, scheduled jobs, optional in-cluster
Postgres) lives in `deploy/helm/kuwana`. See **[DEPLOYMENT.md](DEPLOYMENT.md)** — including the one
real constraint: `NEXT_PUBLIC_*` values are compiled into the client bundle, so staging and
production need separately built images.

The Vercel path is unchanged. `next.config.ts` only switches to standalone output when
`NEXT_OUTPUT_STANDALONE=1`, which nothing but the Docker build sets.

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

- ~~**`ANTHROPIC_API_KEY` is still a placeholder** (10 chars) — `/api/chat` and
  `/api/recommendations` will fail end-to-end until a real key is set. This is the single highest-
  leverage remaining blocker and isn't something that can be resolved without the account holder.~~
  — **resolved 2026-08-09**: replaced Anthropic with self-hosted Llama 3.2 Vision
  (see dedicated entry below). No paid key needed; the only setup is a local
  Ollama install with `ollama pull llama3.2-vision` running.
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
- ~~`process-event.ts` gamification-engine tests weren't added~~ — now covered (12 tests) via an
  in-memory fake transaction client — see `src/lib/gamification/process-event.test.ts`.
  (`requireConsumer`/`requireAdmin` are covered too, with mocked Supabase/Prisma — see
  `src/lib/auth.test.ts`.)
- ~~`onboarding-facts.ts`'s historical trivia was unsourced/unverified~~ — fact-checked via web
  search; found and fixed 5 real inaccuracies (Econet wasn't first to launch, Nedbank/Stanbic
  founding years, Cimas's false "oldest" claim, an uncorroborated CBZ contactless-cards claim) —
  see the fix commit for sources.
- ~~A `next`/`postcss`/`sharp` transitive dependency audit warning (3 high-severity)~~ — fixed by
  bumping `next` 16.2.12 -> 16.3.0 (a minor bump, not the major one initially assumed) + matching
  `eslint-config-next`. `npm audit` now reports 0 vulnerabilities; full verification + a runtime
  smoke test both passed. That bump also auto-generates `AGENTS.md`/`CLAUDE.md` on every
  `next dev`/`build` (new in 16.3.0) — committed per the generator's own recommendation.

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

## 2026-08-09: provider swap — Anthropic → self-hosted Llama 3.2 Vision

The AI endpoints (`/api/chat`, `/api/recommendations`, `/api/need-intake`) no longer use Anthropic.
This closes the highest-leverage blocker in the previous session log (`ANTHROPIC_API_KEY` was a
10-char placeholder) without requiring an account holder to provision a paid key.

**Why Llama 3.2 Vision:**
- It's the spec the build originally called out (Zimbabwe-friendly, open-source, multimodal — the
  brief explicitly forbids invented stats, and open-weight models plus a JSON-schema prompt is
  the cleanest path to that).
- It's the only model family that gives Kuwana both vision *and* (via Ollama's native `/api/chat`)
  guaranteed-valid JSON-schema output in one place, which is what the recommendations and
  intake endpoints were using `output_config` for on Anthropic.

**What changed:**

- **New `src/lib/ai/llama.ts`** — a small, fetch-based client for Ollama's native `/api/chat`
  (not the OpenAI-compat surface, which on Ollama is experimental and lacks vision + structured
  output). Two functions: `llamaChat({ messages, format, options })` for non-streaming with
  optional JSON-schema `format`, and `llamaChatStream({ messages, options })` as an async
  generator of text deltas (parses NDJSON). Plus a `base64FromDataUrl` helper that strips the
  `data:image/png;base64,` prefix because Ollama wants raw base64 in `images: [...]`.
- **`/api/chat`** — streaming now consumes `llamaChatStream`. Image input switched from
  Anthropic's `{ type: "image", source: { type: "base64", media_type, data } }` to Ollama's
  `{ type: "image", image: <base64> }` (alongside a `{ type: "text" }` part). The previous
  silent-catch on stream failure now logs `[chat] Llama stream failed:` before emitting the
  error marker, so prod failures are diagnosable.
- **`/api/recommendations`** — uses `llamaChat` with the JSON Schema passed via `format`. 503
  fallback preserved on `LlamaUnavailableError` (network / non-2xx); a parse failure on the
  (schema-guaranteed) JSON now returns 502 with a log line.
- **`/api/need-intake` → `classifyIntake`** — same swap, schema in `format`, temperature pinned to
  0 for deterministic routing.
- **`src/lib/ai/anthropic.ts` deleted.** The `@anthropic-ai/sdk` dependency is removed from
  `package.json` (run `npm install` once to actually drop it from `node_modules`).
- **`.env.example`** — `ANTHROPIC_API_KEY` replaced by `LLAMA_VISION_BASE_URL` (default
  `http://localhost:11434`), `LLAMA_VISION_MODEL` (default `llama3.2-vision`), and optional
  `LLAMA_VISION_API_KEY` for the case where the endpoint is behind an auth gateway.

**Local setup:**

```bash
ollama pull llama3.2-vision
ollama serve   # default port 11434
npm run dev
```

`/api/chat`, `/api/recommendations`, and `/api/need-intake` now work end-to-end with no cloud
account. Any other server that speaks `/api/chat` (vLLM, llama.cpp, an OpenAI-compatible
gateway pointed at a Vision model) works too — just point `LLAMA_VISION_BASE_URL` at it.

**What was deliberately *not* changed:**

- The recommendation **system prompt** and **JSON schema** — the model's *job* didn't change,
  only the model doing it. The "never invent statistics" / "reference requirements_to_qualify
  concretely" rules are still in place and still load-bearing.
- The 60-minute **recommendation cache** in `src/lib/recommendationCache.ts` — same key shape,
  same TTL, no need to flush.
- The chat's **`STREAM_META_MARKER` / `STREAM_ERROR_MARKER`** protocol between server and
  client (`src/lib/chatStream.ts`) — the chat composer's reader is provider-agnostic and didn't
  need to change.
- Vitest suite — the AI-endpoint pure-logic tests don't touch the network layer; the only
  behavior tests we have (`providerAuth.test.ts`, `providerListingSchema.test.ts`) are about
  routing, not the model.

**Known limitations of this swap (worth flagging, not silently done):**

- Llama 3.2 Vision 11B is meaningfully weaker than Claude Opus on nuanced comparative reasoning.
  The recommendations endpoint is exactly that kind of task. We expect to see slightly less
  incisive explanations on edge cases; the structured grounding data still keeps the answer
  traceable, and the system prompt still forbids inventing numbers.
- No fallback. If the local Llama endpoint is down, the AI endpoints 503 with a clear message.
  Acceptable for an open-source MVP; would want a managed fallback before any user-facing SLA.

## 2026-08-12: lint script fix + PR #4 (`app-line`) merge

**`npm run lint` was silently not running lint.** Next.js 16 removed the `next lint` command
(bundled `next build` no longer lints either) — the script was still calling it, so every run
errored out on an "invalid project directory" before eslint executed. Every "eslint clean" claim
in commit messages since the 16.3.0 bump was checking a command that never actually ran. Fixed to
`"lint": "eslint src"`; running it for real surfaces 3 small pre-existing issues (unrelated to this
fix, left as-is): a component created during render and an unused import in `CategoryBadge.tsx`,
and an `any` in `scoring.ts`.

**PR #4 merged a large parallel branch (`app-line`) into `main`** — 201 files, ~9,200 insertions.
Ships several things this file previously described as planned, proposed, or living on a different
provider:

- The Anthropic → Llama 3.2 Vision swap described in the 2026-08-09 entry above is now actually on
  `main`. `ANTHROPIC_API_KEY` in `.env` is vestigial — nothing in `src/` reads it. Note for anyone
  deploying beyond local dev: `LLAMA_VISION_BASE_URL` defaults to `http://localhost:11434`, which
  will not resolve from a Vercel serverless function — a real reachable endpoint is needed before
  this works in production.
- `notebooks/` — a Python/Jupyter modeling workstream (`value_score_baseline`,
  `recommendation_engine`) that exports a DB snapshot and fits per-category attribute weights.
  `src/lib/fittedWeights.ts` + `scoreWithFit()` in `src/lib/catalog.ts` use a fit from
  `notebooks/data/fitted_weights.json` when one exists, falling back to the hand-tuned heuristic
  otherwise. Not yet a trained model — see `notebooks/README.md`.
- `scripts/social-scan/` — scans public Reddit/Telegram content for price mentions, tags them with
  a matched provider name, and stores them in `SocialPriceMention` for manual admin review only;
  never writes to `Listing`/`Provider` directly.
- PDF export off the compare view (`src/lib/comparePdf.ts`), a `/history` page, real provider logo
  assets (`public/provider-logos/`), new loading screens (`GalleryTunnel`, `LoadingFacts`), and a
  `docker-compose.3tier.yml` + `prisma/schema.3tier.prisma` sketch (not adopted — the app still
  runs on the existing Supabase/Prisma setup).

**The merge initially broke `main`'s build.** A conflict between this branch and concurrent
perf/pin-unpin work on `main` got resolved by keeping both sides of several conflicts (duplicate
`const`/object-property declarations across `proxy.ts`, `scoring.ts`, the `chat`/`events`/
`need-intake`/`recommendations` routes, and `ProviderLogo.tsx`) instead of picking one, plus a spot
in `catalog.ts` where one function's declaration landed in the middle of another's unclosed body.
Fixed and reverified (`tsc --noEmit` clean, 234/234 tests) same day — see `HANDOFF.md`'s
2026-08-12 entry for the full account. If you're reading this soon after: confirm via `git status`
that the fix is actually committed before trusting this paragraph.

## 2026-08-17: merged-branch cleanup

Deleted 8 remote branches whose commits were all already ancestors of `origin/main` (verified with
`git merge-base --is-ancestor` before deleting, not just `git branch --merged`'s default heuristic):
`app-line`, `claude/intelligent-babbage-nolyma`, `claude/mvp-build-g0hap4`, `database-schema`,
`fix/dependabot-merge-breakage` (PR #17), `hardening/caching-and-rendering` (PR #18),
`hardening/production-readiness`, `llm-provider-routing`. Nothing on these branches is unique —
their history lives on in `main`'s log if any of it needs to be found again.
