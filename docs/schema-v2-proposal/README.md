# Schema v2 — proposal, not the live schema

Everything in this directory is a **design proposal**. None of it describes the database the
application currently runs against. The live schema is, and remains, `prisma/schema.prisma`.

| File | What it is |
|---|---|
| `schema.v2.prisma` | The proposed rewrite. Was briefly committed to `prisma/schema.prisma`. |
| `schema.3tier.prisma` | A three-tier variant of the same proposal. |
| `init.sql` | Hand-written DDL matching the proposal. |

The narrative documents and diagrams that go with these live in `docs/` and `resource/`
(`database-architecture.md`, `3-tier-database-architecture.md`, `WHOLE_DATABASE_DIAGRAM.md`, and
the `kuwanaai_*.webp` ERDs).

## Why these files are here and not in `prisma/`

`schema.v2.prisma` was originally committed **as** `prisma/schema.prisma` — the exact path Prisma
reads by default. PR #3 merged this design spike into the working application, the resulting
conflicts were committed unresolved, and `main` was left both uninstallable (`package.json` had
conflict markers) and unbuildable. The application code still targeted the old shape, so nothing
matched anything.

Moving the proposal to `docs/` means it can be read, reviewed and argued about without any tool
mistaking it for the live schema.

## What adopting it would actually involve

This is a genuine rewrite, not a rename, and it is worth being explicit about the size before
anyone starts:

- **All 10 enums re-cased and partly renamed** — `published` → `PUBLISHED`, `consumer` →
  `CONSUMER`, `telecom` → `TELECOMS`, `live` → `ACTIVE`.
- **`Sector` membership changes.** Adds `ENERGY`, `RETAIL_GROCERY`, `FUEL`, `HOUSING`; drops
  `electronics`, `fashion`, `pharmacy`, `utilities` — which currently hold roughly 29 seeded
  listings that would need remapping onto the new members, not just an enum edit.
- **`EventType` fully renamed**, and `action_taken` disappears entirely. The gamification engine
  keys off these.
- **`Listing.name` → `Listing.title`.**
- **`Listing.price` and `Listing.currency` are removed**, leaving `ListingPriceHistory` as the only
  home for price. This is the hardest part: `orderBy: { price: "asc" }` and the composite index
  `listings(category_id, status, price)` both stop being expressible, and "current price" becomes a
  derived value rather than a column.
- **`Listing.provider` becomes nullable**, against ~20 unguarded `listing.provider.x` dereferences.
- `Listing.sourceUrl`, `lastVerifiedAt` and `rejectionReason` disappear; `Provider.verified`
  becomes `isVerified`; `Category.attributeSchema` becomes `attributeSchemas`.

Surveyed blast radius: **~55 files, ~430 call sites**, plus 8 of the test files and the seed script.

## If you do adopt it

Do it as its own reviewed piece of work, with these in place first:

1. **CI on `main`.** The absence of it is the direct reason a non-installable tree sat on the
   default branch. A migration this size without a build gate will not end differently.
2. **A data migration for the dropped sectors**, ordered *before* the enum members are removed —
   afterwards those rows cannot be addressed.
3. **A decision on current price** — most likely a denormalized `Listing.currentPrice` maintained
   on write, since deriving it per read reintroduces the sort and index problems above.
4. **A database backup.** `ALTER TYPE ... RENAME VALUE` across ten enums, plus a column rename and
   two column drops, is not cleanly reversible.
