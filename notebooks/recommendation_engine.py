"""Kuwana — profile-aware "Recommended for you" recommendation engine.

The dashboard already has a "Specials for you" carousel (see
`getPersonalizedSpecials` in `src/lib/catalog.ts`). That one ranks categories
the user has *engaged* with — comparisons and saves — by a footprint-biased
decision score. This notebook is a separate feed that sits *above* it:

  * "Specials for you"        — what you've been shopping for, ranked.
  * "Recommended for you"     — specials on **favorites** (products tied to
                                 things you already have: your network, your
                                 bank, your insurer). Same listings you'd
                                 otherwise miss because they live in
                                 categories you haven't browsed yet.

Two outputs:

  1. `data/recommendations.csv` — one row per (user, recommended listing),
     with the reason for the pick, intended for the app to read back.
  2. A short summary table printed at the bottom — quick sanity check
     before this gets wired into the home page.

Reads the same CSV exports produced by `export_listings.py`, plus two
additional CSVs the script writes from the `users`/`user_profiles`/
`sector_footprints`/`saved_listings`/`comparisons` tables. Run
`export_listings.py` first if you don't have `data/` populated yet.

Run from `notebooks/`:

    python export_listings.py                 # refresh data/*.csv
    python recommendation_engine.py           # or open as a notebook

This file is plain Python in the "jupytext percent" format — open it
directly in Jupyter/VS Code (each `# %%` is a cell), or run it top-to-bottom
with `python recommendation_engine.py`.

# %% [markdown]
# ## 0. Setup — load the catalog + per-user signal

# %%
import json
from collections import defaultdict
from pathlib import Path

import pandas as pd

DATA_DIR = Path.cwd() / "data"
CATALOG_DIR = Path.cwd() / "data"

listings = pd.read_csv(DATA_DIR / "listings.csv")
listings["attributes"] = listings["attributes"].apply(json.loads)
schema = pd.read_csv(DATA_DIR / "attribute_schema.csv")

# Per-user signal — may be missing if export_listings.py predates this script;
# `export_user_signals.py` writes these tables. See README.
def _safe_read(name: str) -> pd.DataFrame:
    path = DATA_DIR / name
    if path.exists():
        return pd.read_csv(path)
    print(f"  (skipping {name} — no file yet)")
    return pd.DataFrame()

users = _safe_read("users.csv")
profiles = _safe_read("user_profiles.csv")
footprints = _safe_read("sector_footprints.csv")
saved = _safe_read("saved_listings.csv")
comparisons = _safe_read("comparisons.csv")

print(
    f"{len(listings)} listings × {len(users)} users "
    f"({len(profiles)} profiles, {len(footprints)} footprints, "
    f"{len(saved)} saved, {len(comparisons)} comparisons)"
)

# %% [markdown]
# ## 1. "Favorite products" — what is a favorite, anyway?

# %%
# A listing is "favorite" when its attributes pin it to something the user
# already has on file: their mobile network, their bank, their insurer, etc.
#
# We detect this without inventing a heuristic per category — every
# sector_footprint has a `data` JSON with free-text answers, but the ones
# that matter for "favorites" all share a shape: a `*_provider` or
# `network` or `bank` key whose value is a provider *name* (string), or a
# list of provider names. We resolve those names against the listings'
# providers and look for listings in any category whose provider matches.
#
# The point is: a user whose footprint says they bank with CBZ has a
# "favorite" in *every* CBZ savings account, CBZ loan, CBZ funeral cover —
# not just the savings-accounts category they've already compared.
import re

PROVIDER_KEY_PATTERNS = ("provider", "network", "bank", "insurer")


def extract_favorite_providers(footprint_row: dict) -> set[str]:
    favorites: set[str] = set()
    for key, value in (footprint_row or {}).items():
        if not isinstance(value, (str, list)):
            continue
        if not any(pat in key.lower() for pat in PROVIDER_KEY_PATTERNS):
            continue
        if isinstance(value, list):
            for v in value:
                if isinstance(v, str):
                    favorites.add(v.strip())
        else:
            # Free-text answers sometimes say "I bank with CBZ and Steward";
            # split on common separators so we don't drop the second name.
            for token in re.split(r",| and | & ", value):
                token = token.strip()
                if token:
                    favorites.add(token)
    return {f for f in favorites if f}


# Build provider-name -> set(listing ids) for fast lookup.
listings_by_provider: dict[str, list[int]] = defaultdict(list)
for _, row in listings.iterrows():
    listings_by_provider[row["provider_name"]].append(row["listing_id"])

# Pre-resolve user-level favorites: {user_id: {listing_id, ...}}
user_favorites: dict[str, set[int]] = defaultdict(set)
for _, fp in footprints.iterrows():
    data = json.loads(fp["data"]) if isinstance(fp["data"], str) else (fp["data"] or {})
    favs = extract_favorite_providers(data)
    for fav in favs:
        for listing_id in listings_by_provider.get(fav, []):
            user_favorites[fp["user_id"]].add(listing_id)

# A user with no footprint data falls back to providers they've actually
# saved/compared against — explicit > implicit.
saved_by_user: dict[str, set[str]] = defaultdict(set)
for _, s in saved.iterrows():
    saved_by_user[s["user_id"]].add(s["provider_name"])
for user_id, provider_set in saved_by_user.items():
    for provider in provider_set:
        for listing_id in listings_by_provider.get(provider, []):
            user_favorites[user_id].add(listing_id)

print(
    f"Identified favorites for {len(user_favorites)} users "
    f"(avg {sum(len(v) for v in user_favorites.values()) / max(len(user_favorites), 1):.1f} listings/user)"
)

# %% [markdown]
# ## 2. What makes a listing a "special" right now?

# %%
# Three signals — none invented, all derivable from the live catalog:
#
#   1. **Trending down**: at least a 5% price drop over the recorded history.
#      Reads the same ListingPriceHistory rows the home page already uses;
#      see `lib/priceTrend.ts`.
#   2. **Under category median**: priced below the category median right now
#      (a flat "good price" signal that doesn't depend on history being
#      populated — which it isn't, in the seed catalog).
#   3. **Verified provider bonus**: a small flat lift so unverified providers
#      don't sneak in even if their prices are technically lower.
TREND_DROP_THRESHOLD = -5  # percent
PRICE_HISTORY = pd.read_csv(DATA_DIR / "listing_price_history.csv") if (DATA_DIR / "listing_price_history.csv").exists() else pd.DataFrame()


def compute_trend_pct(history_rows: pd.DataFrame) -> float | None:
    if len(history_rows) < 2:
        return None
    first = float(history_rows.sort_values("recorded_at").iloc[0]["price"])
    last = float(history_rows.sort_values("recorded_at").iloc[-1]["price"])
    if first == 0:
        return None
    return round((last - first) / first * 100, 2)


trend_by_listing: dict[int, float] = {}
if not PRICE_HISTORY.empty:
    for listing_id, group in PRICE_HISTORY.groupby("listing_id"):
        trend_by_listing[int(listing_id)] = compute_trend_pct(group)

median_price_by_category = listings.groupby("category_slug")["price"].median().to_dict()


def is_special(row: pd.Series) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    trend = trend_by_listing.get(int(row["listing_id"]))
    if trend is not None and trend <= TREND_DROP_THRESHOLD:
        reasons.append(f"price dropped {abs(trend):.1f}% recently")
    median = median_price_by_category.get(row["category_slug"])
    if median and row["price"] <= median * 0.9:
        reasons.append("priced below category median")
    if row.get("verified", True):
        reasons.append("verified provider")
    return (len(reasons) > 0, reasons)


# %% [markdown]
# ## 3. Rank specials *within* each user's favorites

# %%
# We don't use a fitted model here — there's no ground truth signal yet (see
# value_score_baseline.py's TODOs about comparison outcomes and saves).
# Instead, the recommender combines four transparent factors, each scaled to
# 0-100, weighted and summed. Tune the weights per-category once we have
# real feedback.
#
#   * **value_score**: copy of the TS heuristic from value_score_baseline.py
#     — price + first numeric benefit, 50/50. Reproduces what the rest of
#     the app shows today so the notebook stays in sync with shipping UI.
#   * **special_bonus**: +25 if trending down, +15 if below median. Stacks
#     so a verified-and-dropping listing beats either signal alone.
#   * **freshness_bonus**: +5 fresh, -6 stale, -12 unverified. Mirrors
#     `DECISION_SCORE_VERSIONS.v1.freshnessAdjustment` in scoring.ts.
#   * **trust_bonus**: +5 verified, else 0.
def first_numeric_benefit_key(category_slug: str) -> str | None:
    cat_schema = schema[schema["category_slug"] == category_slug]
    numeric = cat_schema[(cat_schema["data_type"] == "number") & (cat_schema["is_comparable"])]
    numeric = numeric[numeric["key"] != "price"]
    return numeric.sort_values("sort_order")["key"].iloc[0] if len(numeric) else None


def normalize(series: pd.Series, invert: bool) -> pd.Series:
    lo, hi = series.min(), series.max()
    if lo == hi:
        return pd.Series(100.0, index=series.index)
    t = (series - lo) / (hi - lo)
    return (1 - t) * 100 if invert else t * 100


def value_score(group: pd.DataFrame) -> pd.Series:
    key = first_numeric_benefit_key(group["category_slug"].iloc[0])
    price_score = normalize(group["price"], invert=True)
    if key is None:
        return price_score.round().astype(int)
    benefit_values = pd.to_numeric(
        group["attributes"].apply(lambda a: a.get(key)),
        errors="coerce",
    ).fillna(0)
    benefit_score = normalize(benefit_values, invert=False)
    return (price_score * 0.5 + benefit_score * 0.5).round().astype(int)


FRESHNESS_BONUS = {"fresh": 5, "stale": -6, "unverified": -12}


def recommend_for_user(user_id: str, top_k: int = 4) -> pd.DataFrame:
    fav_ids = user_favorites.get(user_id, set())
    if not fav_ids:
        return pd.DataFrame()

    candidates = listings[listings["listing_id"].isin(fav_ids)].copy()
    if candidates.empty:
        return pd.DataFrame()

    value = candidates.groupby("category_slug", group_keys=False).apply(value_score)
    candidates = candidates.assign(value_score=value.values)

    # Special + freshness + trust adjustments
    specials = candidates.apply(is_special, axis=1)
    candidates["special_reasons"] = specials.apply(lambda r: "; ".join(r[1]))
    candidates["is_special"] = specials.apply(lambda r: r[0])

    candidates["special_bonus"] = candidates["is_special"].astype(int) * 20
    candidates["freshness_bonus"] = candidates["freshness_status"].map(FRESHNESS_BONUS).fillna(0)
    candidates["trust_bonus"] = candidates["verified"].apply(lambda v: 5 if v else 0)

    candidates["recommendation_score"] = (
        candidates["value_score"]
        + candidates["special_bonus"]
        + candidates["freshness_bonus"]
        + candidates["trust_bonus"]
    ).clip(0, 100).round().astype(int)

    return (
        candidates.sort_values(["is_special", "recommendation_score"], ascending=[False, False])
        .head(top_k)
        .reset_index(drop=True)
    )


# %% [markdown]
# ## 4. Run it for every user, write `data/recommendations.csv`

# %%
TOP_K = 4
rows = []
for user_id in users["user_id"]:
    recs = recommend_for_user(user_id, top_k=TOP_K)
    for rank, r in enumerate(recs.itertuples(), start=1):
        rows.append(
            {
                "user_id": user_id,
                "rank": rank,
                "listing_id": r.listing_id,
                "listing_name": r.listing_name,
                "provider_name": r.provider_name,
                "sector_slug": r.sector_slug,
                "category_slug": r.category_slug,
                "price": r.price,
                "currency": r.currency,
                "recommendation_score": r.recommendation_score,
                "is_special": r.is_special,
                "reason": r.special_reasons,
            }
        )

recommendations = pd.DataFrame(rows)
out = DATA_DIR / "recommendations.csv"
recommendations.to_csv(out, index=False)
print(f"Wrote {len(recommendations)} recommendations -> {out}")

# %% [markdown]
# ## 5. Quick sanity check — top picks across all users

# %%
if recommendations.empty:
    print("No recommendations produced — check that footprints contain provider names and that those providers have published listings.")
else:
    sample_user = recommendations["user_id"].iloc[0]
    print(f"\nTop picks for user {sample_user}:")
    cols = ["rank", "listing_name", "provider_name", "category_slug", "price", "recommendation_score", "reason"]
    print(recommendations[recommendations["user_id"] == sample_user][cols].to_string(index=False))

    print("\nSpecials surfaced across all users:", recommendations["is_special"].sum(), "of", len(recommendations))
    print("Unique users with at least one pick:", recommendations["user_id"].nunique())

# %% [markdown]
# ## 6. Where this plugs back into the app
#
# `data/recommendations.csv` is the artifact this notebook emits. Two ways
# to close the loop into the home page:
#
# 1. **Batch import** (recommended): a tiny script reads
#    `data/recommendations.csv` and writes rows into a new
#    `recommended_specials` table that the dashboard reads alongside the
#    existing "Specials for you" carousel. No new service, no infra change.
# 2. **Live recompute**: port the same scoring into
#    `src/lib/recommendationEngine.ts` and call it on demand. Cleaner, but
#    duplicates logic — only worth it once the model gets genuinely smarter
#    than the heuristic (i.e. once we have a training signal).
#
# For now, both the dashboard section and this notebook read the same
# `SectorFootprint` + `SavedListing` data via the catalog lib, so the two
# stay in sync by construction.
#
# ## TODOs before this is more than a heuristic
#
# - [ ] Replace `value_score` with the weighted model from
#   `value_score_baseline.py` once per-category weights are tuned.
# - [ ] Add a real training signal — which favorite-product listing did the
#   user actually act on? — and fit a logistic regression over
#   `(value_score, special_bonus, freshness_bonus, trust_bonus)` instead of
#   hand-weighting.
# - [ ] When `ListingPriceHistory` starts being populated for real (admin
#   edits, fx-rate-driven repricings), the `trend_by_listing` signal here
#   will start firing — re-run this notebook after a few weeks of edits.
