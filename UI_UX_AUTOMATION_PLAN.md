# Kuwana — UI/UX & Automation Enhancement Plan

**Status:** proposal — nothing in this document is implemented yet. It extends the shipped MVP
(`KUWANA_MVP_BUILD_PLAN.md`, Phases 0–5, already built) with a second wave of UI/UX patterns
borrowed from reference apps, plus the backend automation needed to power them honestly (no
invented numbers — every "trending," "price drop," or "also compared" signal must trace back to
real seeded/user data, per the original plan's Section 9 rule).

---

## 1. Inspiration sources reviewed

| Source | What was pulled from it |
|---|---|
| **Takealot** (mobile app) | Bottom tab bar (Home/Categories/Deals/Lists/Account), "Pick up where you left off" personalized carousel, "Trending in [category]" rails, structured Account menu (Orders/Returns/Coupons/Settings/Help/Logout/version), dedicated Wishlist screen with "Customers Also Bought" |
| **Amazon** (web) | Hero promo banners, grouped tile sections ("Must-haves for every student"), category grid, cross-sell rails |
| **SHEIN** | Bottom nav (Shop/Category/Trends/Cart/Me), left-rail category list beside a product grid, "Me" account hub (Vouchers/Points/Wallet, order-status pills, History/Wishlist/Following), cart screen with honest urgency badges (Price Drop, low-stock, "X% bought at this price") grouped by seller |
| **Meta AI** | Conversational entry screen — greeting + tappable suggestion chips + a single chat input with mic/attach icons |
| **EcoCash Super App** | Billers/people/transaction search bar, a social-style **Discover/For You/Trending** feed with story bubbles |
| **A ride-hailing app (Bolt/inDrive-style)** | Slide-out drawer with profile at top, list-style secondary nav (History/Notifications/Safety/Settings/Help/Support), a horizontal service-type icon selector, a "recent destinations" list with clock icons |
| **Dial a Delivery** (Zimbabwean food delivery) | Bold two-button primary CTA on brand-color background ("Order for Delivery" / "Click & Collect"), branded loading state ("Fetching Restaurants…"), hamburger drawer (Home/My Account/My Orders/Help/Terms/Logout + version number) |

The user's brief singled out **Takealot and Amazon specifically for "automation and
functionality"** — i.e., not just their visuals, but the *systems* behind personalization,
cross-sell, and urgency signals. Section 3 below is written with that emphasis: every UI addition
here is paired with the backend automation that has to exist for it to be real rather than
decorative.

---

## 2. Gaps in the current build this plan closes

Verified against the shipped code, not assumed:

1. **No search anywhere.** `ExploreClient` and the listing detail page have zero search input —
   users can only browse by category tabs. Every inspiration source above leads with a search bar.
2. **No desktop navigation.** `BottomTabBar` is `md:hidden` — on tablet/desktop, authenticated
   pages currently have **no persistent nav at all**.
3. **`ListingPriceHistory` table exists in the schema and is never written to or read from.** The
   price-drop/urgency pattern (SHEIN, Takealot) has no data source yet.
4. **No cross-sell.** `Comparison.listingIds` already captures which listings get compared
   together — nobody queries it for "customers who compared this also compared…"
5. **No "recently viewed."** `comparison_viewed` events are logged but never surfaced back to the
   user (Takealot's "Pick up where you left off").
6. **No trending signal.** Nothing aggregates `UserEvent`/`Comparison` volume into a "127 people
   compared this this week" style signal (EcoCash's Trending tab, Takealot's "Trending in Sport").
7. **Single generic CTA on listing detail.** `ListingActions` shows one dynamic button; Dial a
   Delivery's two-clear-choices pattern (Delivery vs. Click & Collect) maps well to Kuwana's
   telecom/banking reality (dial USSD vs. visit branch/app), currently collapsed into one button.
8. **Recommendation calls are not cached.** Comparing the same 2–3 listings twice re-calls Claude
   and re-bills — Amazon/Takealot-style "automation" implies caching computed results, not
   recomputing them.

---

## 3. Feature plan

Each item: **UI** (what the user sees) → **UX rationale** → **Backend** (schema/API/automation
needed) → **Source** → **Priority** (P0 = do first, P2 = nice-to-have).

### 3.1 Global search — *Takealot / SHEIN / EcoCash*

- **UI:** persistent search bar at the top of `/explore` and each `/explore/[sector]` page —
  "Search plans, banks, providers…" with a recent-searches dropdown (clock icon, ride-app style).
- **UX:** the single biggest gap. Users comparing telecom bundles today have no way to jump
  straight to "Econet 20GB" — they must know which category tab to open first.
- **Backend:**
  - Add a Postgres full-text index: `ALTER TABLE listings ADD COLUMN search_vector tsvector`
    generated from `name`, and join `providers.name` at query time (or denormalize provider name
    into the same tsvector via a trigger). This is the Postgres-native version of the
    "search-indexing pipeline" the original plan flagged in Section 11 — no external search
    service needed at this scale.
  - New route `GET /api/search?q=...` — ranked results across all live sectors, returning
    `{ listingId, name, provider, sector, category, price }`.
  - Client-side: store last 5 searches in `localStorage` (no new table needed — this is
    per-device, not account state).
- **Priority: P0.**

### 3.2 "Pick up where you left off" — *Takealot*

- **UI:** a dashboard carousel above the sector tile grid showing the last 4–6 distinct listings
  the user viewed, most recent first.
- **UX:** closes the loop on browsing sessions that got interrupted — a core Takealot retention
  mechanic.
- **Backend:** no new schema — query the existing `user_events` table for the most recent
  distinct `metadata->>'listingId'` where `event_type IN ('comparison_viewed','action_taken')`,
  ordered by `created_at DESC`, deduplicated. Add `getRecentlyViewed(userId, limit)` to
  `src/lib/catalog.ts`, mirroring the existing `getTopListings` helper.
- **Priority: P0** (cheap — pure read against data already being logged).

### 3.3 "Customers who compared this also compared…" — *Amazon / Takealot*

- **UI:** a rail on `/listing/[id]` below the spec table, matching the `HeroCarousel` visual
  language already established on the dashboard.
- **UX:** the canonical Amazon cross-sell pattern — directly serves the plan's "customers also
  compared" reference from the original build spec (Section 11), never actually built.
- **Backend:** a co-occurrence query over `comparisons.listing_ids` (a Postgres array column):
  for a given listing, find other listings that appear in the same `comparisons` rows, ranked by
  frequency, excluding the listing itself. This is a single SQL query
  (`unnest(listing_ids)` + self-join), cacheable per listing since it only needs to recompute when
  new comparisons land. No new schema — just a new function in `lib/catalog.ts` and a call site
  on the listing detail page.
- **Priority: P1.**

### 3.4 Trending signal — *EcoCash Discover/Trending, Takealot "Trending in Sport"*

- **UI:** a "Trending this week" badge/rail per sector on `/explore/[sector]`, and a small
  "🔥 X comparisons this week" line on hero-carousel cards.
- **UX:** social proof, but honest — every number traces to real events, never invented (hard
  constraint from the original plan carried into this one).
- **Backend:** aggregate `user_events` where `event_type = 'comparison_completed'` and
  `created_at >= now() - interval '7 days'`, grouped by listing/category, ordered by count. At
  current scale this runs fine on read (no cron needed). If volume grows, promote to a materialized
  view refreshed hourly — flagged here as a scaling note, not built now.
- **Priority: P1.**

### 3.5 Price-drop alerts — *SHEIN "Price Drop" tag, Takealot "Price & back-in-stock notifications"*

- **UI:** a "Price dropped X%" badge on listing cards and in `/profile/saved`; a small red dot on
  the bottom-tab Profile icon when a saved listing has a new drop.
- **UX:** the single most "automation"-flavored feature in this plan — it turns Kuwana from
  passive comparison into active monitoring, which is exactly what Takealot's saved-item
  notifications do.
- **Backend:** this is the one feature that needs real new plumbing, since `ListingPriceHistory`
  is currently unused:
  1. Whenever a listing's `price` is updated (re-seed, admin edit, or — post-MVP — a live scrape),
     write the prior price into `listing_price_history` before overwriting it (a small helper,
     `recordPriceChange(listingId, newPrice)`, wrapping the existing `prisma.listing.update` calls).
  2. A `computePriceDropAlerts()` function: for every `saved_listings` row, compare the listing's
     current price to its most recent `listing_price_history` entry; if it dropped ≥ 5%, surface it.
     Run this on-demand when `/profile/saved` loads (cheap at MVP scale) rather than a background
     job — consistent with the "no queue infrastructure for MVP" constraint in the original plan.
  3. New route `GET /api/saved/alerts` returning listings with an active price-drop flag.
- **Priority: P1** — the schema already exists; this is mostly wiring, not new design.

### 3.6 Desktop navigation — *Dial a Delivery hamburger drawer, ride-app side drawer*

- **UI:** a persistent top bar on `md:` and above with the Kuwana wordmark, primary nav links
  (Dashboard/Explore/Profile), and a right-aligned account menu — closing the gap where
  `BottomTabBar` disappears (`md:hidden`) and nothing replaces it. On mobile, add the same
  drawer as a secondary "More" sheet for Settings/Leaderboard/Help, reachable from the Profile tab,
  styled after the ride-app drawer (profile summary at top, list rows below, version number at the
  bottom, matching Takealot's Account screen structure exactly).
- **UX:** desktop users currently have no way to navigate at all except back/forward — this is a
  functional bug, not just a polish item.
- **Backend:** none — purely a new `DesktopNav.tsx` / `AccountDrawer.tsx` component pair, added to
  the authenticated layout.
- **Priority: P0** (it's a broken experience today, not an enhancement).

### 3.7 Two-choice action CTA — *Dial a Delivery*

- **UI:** on `/listing/[id]`, replace the single conditional button in `ListingActions` with two
  explicit, equally weighted choices where both are genuinely available — e.g. for telecom/banking
  listings with no `source_url`: **"Dial \*123#"** and **"Find nearest branch/agent"** side by
  side, mirroring Dial a Delivery's "Order for Delivery" / "Click & Collect" split.
- **UX:** one dynamic button hides the fact that Zimbabwean telecom/banking users usually have two
  real options (USSD vs. in-person); showing both, framed like a delivery-app choice, is more
  actionable than the current single-button fallback text.
- **Backend:** no schema change — extend `attributes` usage or add two nullable fields to
  `Listing` (`ussd_code`, `branch_locator_url`) populated in seed data for banking/telecom
  categories; both actions still log `action_taken` for gamification exactly as today.
- **Priority: P2.**

### 3.8 "Ask Kuwana" conversational assistant — *Meta AI*

- **UI:** a new entry point (bottom-tab long-press, or a floating action button on Explore) opening
  a chat screen: greeting ("What are you comparing today?"), 4–5 suggestion chips ("Cheapest data
  bundle under $10", "Best savings account for students", "Compare two insurance policies"), and a
  single text input.
- **UX:** today, getting a recommendation requires manually selecting 2+ listings first. A
  conversational entry point lets a user describe what they want in plain language and land
  directly on a comparison — this is the highest-effort, highest-payoff item in this plan.
- **Backend:** the most substantial new piece:
  - A new `/api/assistant` route using the Claude API with **tool use** (see the `claude-api`
    skill's Tool Use Patterns): give the model a `search_listings` tool backed by the same catalog
    query from 3.1, and a `compare_listings` tool that returns the same scored payload
    `/api/recommendations` already builds. The model decides which categories/listings to pull in
    response to free text, then calls the existing recommendation logic — no separate AI pipeline,
    just a conversational front end over the two capabilities Kuwana already has.
  - Persist assistant turns to a new lightweight `AssistantMessage` table (`id, userId, role,
    content, createdAt`) — kept deliberately separate from `Recommendation` (which stays the
    audit-grade, listing-specific record) so casual chat history doesn't pollute the auditable
    recommendation log.
  - Rate-limit per user (e.g. 20 messages/day) to control Claude API cost — a genuinely new backend
    concern this feature introduces.
- **Priority: P2** — valuable but the largest single build in this plan; sequence after 3.1–3.6.

### 3.9 Recommendation result caching — *Amazon/Takealot-style automation, not UI*

- **What:** cache `/api/recommendations` output keyed by `(sorted listingIds, categoryId)` for a
  short TTL (e.g. 1 hour) before calling Claude again for the same comparison set.
- **UX:** faster repeat comparisons (common — users flip back and forth while deciding), and it's
  the literal meaning of "automation" the user's brief called out: Amazon/Takealot don't
  recompute "customers also bought" per request, they serve precomputed/cached results.
- **Backend:** a `RecommendationCache` table (`cache_key`, `payload jsonb`, `expires_at`), or —
  simpler for MVP — reuse the existing `recommendations` table: before calling Claude, check for
  an existing `Recommendation` row for the same `listingId` set generated within the TTL window,
  and serve that instead of re-calling the model.
- **Priority: P1** — cheap to build, directly reduces AI spend.

### 3.10 Branded loading & empty states — *Dial a Delivery "Fetching Restaurants…"*

- **UI:** replace the generic spinners in `ExploreClient` ("Loading…") and the compare page with
  short branded loading copy in the Kuwana voice ("Finding the best value…", "Weighing your
  options…"), and skeleton cards instead of blank space — extending the pattern already used on
  the signup processing screen (rotating local facts) to the rest of the app.
- **UX:** small polish, but it's the one pattern every reference app shares — none of them show a
  bare spinner.
- **Backend:** none.
- **Priority: P2.**

---

## 4. Suggested build order

1. **P0 batch** — global search (3.1), recently-viewed carousel (3.2), desktop nav (3.6). These
   fix real functional gaps, not just add polish, and none require new schema.
2. **P1 batch** — cross-sell rail (3.3), trending signal (3.4), price-drop alerts (3.5),
   recommendation caching (3.9). These are where "Takealot/Amazon automation" actually lands —
   mostly backend queries over data already being collected, wired into UI that already exists.
3. **P2 batch** — two-choice action CTA (3.7), "Ask Kuwana" assistant (3.8), branded loading
   states (3.10). Higher build cost or lower urgency; the assistant in particular deserves its own
   focused pass rather than being squeezed in alongside the others.

## 5. Guardrails carried over from the original build plan

- **No invented numbers.** Every trending count, "also compared" ranking, and price-drop
  percentage must trace to a real row in `user_events`, `comparisons`, or
  `listing_price_history` — never a placeholder.
- **No new background job infrastructure.** Trending/price-drop computation stays on-read or
  triggered by the mutation that causes it (a price update), consistent with the "no queue for
  MVP" decision.
- **Mobile-first, WCAG 2.1 AA.** New components (search bar, drawer, chat UI) follow the same
  44×44px touch target and contrast rules as the shipped screens.
- **AI-assisted disclosure stays.** The "Ask Kuwana" assistant must carry the same "AI-assisted,
  not financial advice" framing already present on `/explore/[sector]/compare`.
