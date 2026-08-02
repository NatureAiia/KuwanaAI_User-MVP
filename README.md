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
