# Kuwana — Decision Intelligence Platform Plan

**Status:** proposal — nothing here is implemented yet, except the `notebooks/` modeling
workstream (see Section 8), which was scaffolded and verified to run as part of this same pass.
This supersedes `UI_UX_AUTOMATION_PLAN.md` where they overlap (the "Ask Kuwana" assistant, in
particular — Section 6 here is the fuller version).

**The repositioning this plan is built around:** Kuwana stops presenting itself as a comparison
tool that shows you options, and becomes a decision intelligence system that knows your situation
(via your footprint/profile), watches the market on your behalf (specials, price moves), and tells
you what to do about it — across every category of spend a Zimbabwean household has, not just
telecom/banking/insurance/education.

Reference sources reviewed for this pass (in addition to the Takealot/Amazon/SHEIN/Meta
AI/EcoCash/ride-app/Dial-a-Delivery set from the previous plan):

| Source | What it contributes |
|---|---|
| **Pricelyst.co.zw** (screenshots) | Exactly-this-shape grocery comparison: pick 2–3 retailers → basket compare → category filter chips → real product photography → "Best at [Retailer]" savings cards. Sidebar nav (Home/Discover/AI Assistant), bottom nav on mobile (Home/Discover/Search/AI Chat), a light/dark sun-icon toggle in the header on every screen, multi-currency switcher (USD/ZiG/ZAR/GBP), and an AI chat tab with an image-upload icon next to the text input. |
| **DotCompare.co.zw** | Named as a reference for the comparison-engine mechanics; no screenshots were provided for it. Flagged as an open item below — happy to review it directly if you want specific patterns pulled from it. |
| Supplied color palette | `#0F172A` (near-black navy), `#1E3A8A` (deep blue), `#FBBF24` (amber/gold), `#F8FAFC` (near-white), `#334155` (slate) |

---

## 0–2. Visual system: icons, logos, palette, theme toggle

### Icons & product/brand imagery (item 0)

**Proposed default — confirm or override:** use real icons (Lucide, already in use) for
categories/actions, but for provider *logos* (Econet, CBZ, Old Mutual, Pick n Pay, Engen, etc.),
default to a generated placeholder — a colored circular badge with the provider's initials, in a
palette derived from the brand's dominant color — rather than pulling real trademarked logos from
the internet. Reasoning: hotlinking or scraping a competitor/partner's brand mark into a comparison
product without their agreement is a real trademark/brand-guideline risk, independent of whether
it's technically easy to fetch the image. The seed data already models `providers.logo_url` as a
field — this becomes real the moment a provider (or you, with their permission) supplies an
approved asset; the placeholder badge is what renders until then. **If you'd rather I fetch real
logos anyway, say so explicitly and I will — I'm flagging the tradeoff, not refusing.**

Product imagery (grocery items, Pricelyst-style) is a different case — those are the products
themselves, not brand marks, and manufacturer product photography is standard practice in retail
comparison (Pricelyst does exactly this). For Groceries specifically, plan to source stock photos
per product at seed time, same as any retail catalog build.

### Theme toggle (item 1)

Already built (Settings page, `src/app/settings/page.tsx`) but buried one screen deep. Promote it
to a persistent header control on every authenticated screen — a small sun/moon icon button, top
right, exactly where Pricelyst puts it — instead of only living in Settings. No new backend; this
is wiring the existing `localStorage` + `document.documentElement.classList` toggle into a shared
header component.

### Color palette (item 2)

**Proposed mapping — confirm or override**, since "sky blue" doesn't literally match any of the
five supplied hex values (the closest, `#1E3A8A`, reads as deep navy/royal blue, not sky blue —
worth double-checking you don't have a specific brighter blue in mind, e.g. `#38BDF8`):

| Supplied hex | Proposed role | Replaces |
|---|---|---|
| `#0F172A` | `--bg-base` (dark mode) | current `#0B0F14` |
| `#1E3A8A` | `--accent-primary` / highlight — buttons, active states, links | current `--accent-gold` |
| `#FBBF24` | `--accent-secondary` — value/gain signals, Signal Bloom fill | keeps the gold's original job |
| `#F8FAFC` | `--bg-base` (light mode) | current `#FBF7F0` |
| `#334155` | `--text-secondary` / borders | current slate tones |

This keeps the Signal Bloom / gamification system's gold accent (it's load-bearing across XP,
value scores, and badges — Section 5.3 of the original build plan) and adds the new blue as the
*primary interactive* color, which is what "highlighter" suggests you mean. `--accent-teal` (trust
signals, AI confidence indicator) stays as-is unless you want it folded into the blue too — that
would mean the AI-confidence Signal Bloom and the primary CTA color become indistinguishable,
which I'd flag as a usability regression, not just a style change.

---

## 3. New industries

Pricelyst's grocery-basket mechanic and your explicit list (Groceries, Fuel, Food & Takeaways)
map cleanly onto the existing schema-driven `SECTORS → CATEGORIES → ATTRIBUTE_SCHEMA → LISTINGS`
model — no core engine rewrite, just seed data plus one new UI mode (Section 5). You asked for 3
more "used daily" suggestions; here's what I'd propose, with the reasoning so you can swap any of
them out:

| Suggested sector | Why it fits "daily decision" | Comparable attributes |
|---|---|---|
| **Transport / ride fares** | Kombi, taxi, and ride-hailing (Vaya, inDrive-style) price comparison for a given route — genuinely daily for most urban users, and it's exactly the ride-app reference from the previous plan's inspiration set. | fare estimate, wait time, vehicle type, safety rating |
| **Utilities / prepaid tokens** | ZESA electricity tokens, water, and airtime-adjacent prepaid — not "which provider is cheapest" (usually one utility per area) but "which top-up channel/agent has the lowest fee," which is still a real comparison. | fee per transaction, processing time, channel (app/USSD/agent) |
| **Pharmacy & health essentials** | OTC medication and basic health products/prices across pharmacies — a real recurring household spend, same comparable-attribute shape as groceries. | price, pack size, pharmacy, stock status |

**Confirm which of these (if any) you want**, and whether "all industries" means literally
open-ended (a provider/category can self-register later) or a fixed target list for now — that
changes whether Section 4/7's category admin needs to be self-serve from day one or can stay
seed-data-driven a while longer.

---

## 4. Personalization core loop (items 5, 7, 9 — "personalization is key")

The existing `SectorFootprint` model (per-sector JSON blob: telecom network/plan/spend, banking
accounts used, etc.) already captures the raw signal. What's missing is anything *using* it beyond
the initial onboarding personalization. Two additions:

1. **Extend the footprint shape per new sector** — Groceries needs household size/dietary
   preference, Fuel needs vehicle type, Transport needs frequent routes. Same JSON-blob pattern as
   today, captured contextually on first visit to that sector (per the original plan's Section
   4.1.1 rule — no 20-question signup).
2. **A "Specials for you" surface** (item 7 — the "comparison-special engine"): a query that joins
   a user's footprint/saved-listings against current listing prices, filtered to categories they
   actually engage with, sorted by value score. This is the same `getTopListings`/scoring
   machinery already built (`src/lib/scoring.ts`, `src/lib/catalog.ts`) — the new part is filtering
   by footprint instead of showing the same "best value this week" to everyone. It also becomes the
   default sort bias in the comparison engine itself: a banking-footprint user comparing savings
   accounts sees fee-sensitivity weighted higher if their footprint indicates low monthly spend, for
   example. This is the concrete backend behind "personalization is key" — not a separate feature,
   a filter applied to features that already exist.

---

## 5. Comparison engine modes (item 6 — "like Takealot and DotCompare, simplicity of Pricelyst")

Today's comparison engine handles one shape well: **N listings within one category**, side-by-side
spec table (`/explore/[sector]/compare`). Groceries/Fuel need a second shape Pricelyst nails:
**a basket across 2–3 retailers** — same product set, priced per retailer, cheapest-per-item
highlighted, running total per retailer at the bottom.

Proposed: a new `BasketCompare` mode, reusing the existing `Comparison`/`Listing`/`Provider`
tables (a "retailer" is just a `Provider`; a "basket" is a set of product-category listings scoped
to that provider) rather than inventing parallel schema. UI: the Pricelyst "pick exactly 2 or 3"
modal, then a table where rows are products and columns are retailers — the mirror image of today's
table (rows = attributes, columns = listings). This is net-new UI work, not a schema change.

DotCompare wasn't in the screenshots — if there's a specific mechanic from it you want pulled in
beyond what Pricelyst already covers, point me at it (or I can review the live site) and I'll fold
it into this section.

---

## 6. "Ask Kuwana" — chat + image/scan search (item 4)

Supersedes item 3.8 in the previous UI/UX plan with the full version, including vision:

- **Entry point:** Meta-AI-style greeting + suggestion chips + text input (as previously planned),
  **plus** an image-upload icon in the input bar, matching Pricelyst's chat screen exactly.
- **What the image input is for — needs your confirmation on scope:** the two most likely use
  cases are (a) **scan a flyer/price tag/receipt** to look up or log a price, and (b) **photograph
  a product** (a data bundle voucher, a grocery item, a fuel pump readout) to identify and route
  into a comparison. These need different handling — (a) is closer to OCR/receipt-parsing, (b) is
  closer to product identification. **Which one (or both) did you mean?**
- **Backend:** Claude's vision input (multimodal Messages API — no separate OCR service needed)
  behind a new `/api/assistant` route with tool use: a `search_listings` tool (same catalog query
  as the search feature from the previous plan) and a `compare_listings` tool (reuses
  `/api/recommendations`'s scoring logic directly rather than duplicating it). The model decides
  which tool to call based on the text and/or image it receives.
- **New table:** `AssistantMessage (id, userId, role, content, imageUrl?, createdAt)` — kept
  separate from `Recommendation` (which stays the audit-grade, listing-specific record per the
  original plan's Section 4.3 rationale) so casual chat doesn't pollute the auditable
  recommendation log.
- **Cost control:** rate-limit per user (e.g., 20 messages/day) — vision calls cost more than
  text-only, so this matters more here than it did for the text-only version in the previous plan.

---

## 7. Data sourcing pipeline (item 11)

Per your answer: **design now, keep mock data for now.** Concretely, this means building the
*ingestion adapter interface* the original plan's Section 11 already gestured at
("normalize → validate → embed/index → publish"), without turning any live source on:

```
Source adapter (interface)          Implementations (later, one per source)
  fetch() -> RawListing[]      →       - ManualSeedAdapter   (what exists today)
  normalize(raw) -> Listing            - RetailerScrapeAdapter (needs named target sites + ToS review)
                                        - SocialMediaAdapter    (needs named accounts/pages + API access — separately scoped)
```

Every adapter feeds the same `validate → write to Listing + LISTING_PRICE_HISTORY → publish`
path, so turning on a real source later is additive, not a rewrite. **Before any live source is
turned on**, each one needs: the specific target (site or social account), a ToS/legal check, and
a refresh cadence decision — none of that is guessable, so it's explicitly out of this pass.

---

## 8. Modeling workstream — Jupyter environment (items 8, 9)

**Done as part of this pass** (not just planned): `notebooks/` now exists as a Python environment
separate from the Next.js app —

- `notebooks/requirements.txt` — pandas, numpy, scikit-learn, matplotlib, psycopg2, jupyter
- `notebooks/export_listings.py` — pulls the current catalog from whatever `DATABASE_URL` the app
  is pointed at into CSV, verified against the seeded local database (50 listings exported cleanly)
- `notebooks/value_score_baseline.py` / `.ipynb` — reproduces the TS scoring heuristic in Python as
  a baseline, then a per-category weighted variant as the first step away from the fixed 50/50
  split. **Verified to execute end-to-end with zero errors** (`jupyter nbconvert --execute`).
- `notebooks/README.md` — setup, usage, and an explicit list of what's *not* built yet (there's no
  trained model here — no labeled "best listing" signal exists in the data yet; see the notebook's
  TODOs for what that signal should be).

This is where "you'll add fine-tuned models" (item 9) eventually plugs in — the notebook's closing
section spells out the two realistic paths (export tuned weights as a JSON lookup the TS scoring
function reads, vs. a small model-serving service once there's an actual trained model worth
serving) rather than guessing which one you'll want before there's a model to serve.

---

## 9. Trends & forecasting page (item 10)

A `/trends` page showing price history graphs per listing/category, plus a simple forecast. **This
is blocked on real data, not on UI work**: `ListingPriceHistory` exists in the schema and is
currently never written to (flagged in the previous plan too). Sequence:

1. Start writing to `ListingPriceHistory` whenever a listing's price changes (ties directly into
   the previous plan's price-drop-alerts item — same write path serves both features).
2. Once there's more than one data point per listing, `/trends` becomes a real chart, not a
   placeholder.
3. The forecast itself is a natural extension of the `notebooks/` workstream (Section 8) — a
   time-series model over the same exported data, once there's enough history to forecast from.

---

## 10. Suggested build order

1. **Visual system** (Sections 0–2) — palette swap, header theme toggle, logo-placeholder policy.
   Cheap, high visibility, unblocks nothing else so it can happen anytime.
2. **New sectors' seed data** (Section 3) — once the industry list is confirmed.
3. **Personalization filtering + specials surface** (Section 4) — reuses existing scoring code.
4. **Basket-compare mode** (Section 5) — the one genuinely new UI pattern.
5. **Price-history writes** (Section 9, step 1) — small, and unblocks both `/trends` and the
   previous plan's price-drop alerts.
6. **"Ask Kuwana" with vision** (Section 6) — largest single build; sequence after the above so the
   tools it calls (search, comparison, personalized specials) already exist to hand to it.
7. **Live data sourcing** (Section 7) — only once specific sources are named.

## Open questions (please confirm or correct — not assuming any of these)

1. Palette role-mapping in Section 2 — especially whether "sky blue" means `#1E3A8A` as proposed,
   or a brighter blue you have in mind but didn't include in the swatch.
2. The 3 suggested additional industries in Section 3 — keep, drop, or replace with something
   else "used daily"?
3. Logo/brand-asset sourcing in Section 0 — comfortable with the placeholder-badge default, or want
   me to attempt fetching real provider logos despite the trademark caveat?
4. Section 6 — is the image/scan input for reading prices off a photo (flyer/receipt/price tag), or
   identifying a product from a photo, or both?
5. DotCompare — want me to review the live site directly for specific mechanics, or is Pricelyst's
   pattern (Section 5) sufficient?
