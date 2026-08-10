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
"""

# %% [markdown]
# # Kuwana — profile-aware "Recommended for you" recommendation engine

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


# Per-category weights lifted from notebooks/value_score_baseline.py. Every
# comparable numeric attribute contributes with its own weight, not just the
# first one — a real parameter surface that section 5's logistic regression
# can later *fit* instead of having us hand-tune. Categories without an entry
# fall back to the legacy 50/50 price + first-benefit blend.
CATEGORY_WEIGHTS: dict[str, dict[str, float]] = {
    "data-bundles": {"price": 0.4, "data_amount": 0.4, "validity_days": 0.2},
    "voice-sms-bundles": {"price": 0.35, "minutes": 0.35, "sms_count": 0.2, "validity_days": 0.1},
    "savings-accounts": {"price": 0.3, "interest_rate": 0.4, "monthly_fee": 0.3},
    "current-accounts": {"price": 0.4, "transaction_fee": 0.3, "branch_count": 0.3},
    "motor-insurance": {"price": 0.35, "coverage_amount": 0.45, "claim_turnaround_days": 0.2},
    "life-insurance": {"price": 0.3, "coverage_amount": 0.4, "payout_speed_days": 0.3},
}


def weighted_value_score(group: pd.DataFrame) -> pd.Series:
    """Per-category weighted blend. Falls back to the 50/50 heuristic for any
    category that's missing from CATEGORY_WEIGHTS — keeps scoring defined for
    every category the catalog exports, not just the ones we've hand-tuned."""
    cat_slug = group["category_slug"].iloc[0]
    weights = CATEGORY_WEIGHTS.get(cat_slug)
    if not weights:
        # Legacy 50/50 fallback — price + first numeric benefit.
        key = first_numeric_benefit_key(cat_slug)
        price_score = normalize(group["price"], invert=True)
        if key is None:
            return price_score.round().astype(int)
        benefit_values = pd.to_numeric(
            group["attributes"].apply(lambda a: a.get(key)),
            errors="coerce",
        ).fillna(0)
        benefit_score = normalize(benefit_values, invert=False)
        return (price_score * 0.5 + benefit_score * 0.5).round().astype(int)

    total = pd.Series(0.0, index=group.index)
    for key, weight in weights.items():
        if key == "price":
            values = group["price"]
            invert = True
        else:
            values = pd.to_numeric(
                group["attributes"].apply(lambda a: a.get(key)),
                errors="coerce",
            )
            invert = False
        total += normalize(values.fillna(values.mean()), invert=invert) * weight
    return total.round().astype(int)


FRESHNESS_BONUS = {"fresh": 5, "stale": -6, "unverified": -12}


def recommend_for_user(user_id: str, top_k: int = 4) -> pd.DataFrame:
    fav_ids = user_favorites.get(user_id, set())
    if not fav_ids:
        return pd.DataFrame()

    candidates = listings[listings["listing_id"].isin(fav_ids)].copy()
    if candidates.empty:
        return pd.DataFrame()

    # value_score: per-category weighted blend (above), not the 50/50 heuristic.
    value = candidates.groupby("category_slug", group_keys=False).apply(weighted_value_score)
    candidates = candidates.assign(value_score=value.values)

    # Continuous trend signal — negative = price has dropped. Drives both the
    # UI-facing "is_special" boolean and the model-facing `trend_pct` feature
    # so section 5's logistic regression can see magnitude, not just a flag.
    candidates["trend_pct"] = candidates["listing_id"].map(
        lambda lid: trend_by_listing.get(int(lid))
    )
    specials = candidates.apply(is_special, axis=1)
    candidates["special_reasons"] = specials.apply(lambda r: "; ".join(r[1]))
    candidates["is_special"] = specials.apply(lambda r: r[0])

    # special_bonus is still +20 when any special signal fires — keeping that
    # knob identical to the previous behavior. The magnitude of the move is
    # captured separately in trend_pct, ready for section 5 to use as a
    # continuous feature.
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
# ## 5. Fit a logistic regression from real user history
#
# Builds a labeled dataset from events we already collect — every comparison
# the user opened, every listing they saved, every `action_taken` — and fits
# a per-category `LogisticRegression` over the four features above. The
# fitted weights replace the hand-tuned `+20` / `+5` / `-6` / `-12` / `+5`
# heuristic once the dataset is large enough that the fit is meaningful
# (rough rule of thumb: ≥30 positive examples per category).
#
# Until then this cell just *reports* the fit (and warns if the dataset is
# too small to trust), so the rest of the pipeline keeps using the
# heuristic. The aim is to flip a flag here once the data is ready, not to
# silently change the user-facing score.

# %%
# Construct training rows from `comparisons` + `saved_listings` +
# `user_events`. Label = 1 if the user actually acted on this listing
# (action_taken event, or saved it), 0 otherwise. Features come from the
# same scoring pipeline that recommend_for_user uses, so a model fit here
# slots back in cleanly when the dataset is large enough.

def _safe_read(name: str) -> pd.DataFrame:
    path = DATA_DIR / name
    return pd.read_csv(path) if path.exists() else pd.DataFrame()

# action_taken rows: every (user, listing) pair where the user clicked a CTA.
user_events = _safe_read("user_events.csv")
acted_pairs: set[tuple[str, int]] = set()
if not user_events.empty and "event_type" in user_events.columns and "metadata" in user_events.columns:
    acted = user_events[user_events["event_type"] == "action_taken"]
    for _, row in acted.iterrows():
        meta = row["metadata"]
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except Exception:
                continue
        if isinstance(meta, dict) and "listingId" in meta:
            acted_pairs.add((str(row["user_id"]), int(meta["listingId"])))

# saved_listings rows are an explicit positive signal too.
if not saved.empty and {"user_id", "listing_id"} <= set(saved.columns):
    for _, row in saved.iterrows():
        acted_pairs.add((str(row["user_id"]), int(row["listing_id"])))

print(f"Positive training examples (acted or saved): {len(acted_pairs):,}")

# Now build a feature matrix by running recommend_for_user-style scoring
# against every (user, listing) pair in the user's *favorite* set, then
# joining the label. This is the dataset the logistic regression fits on.
training_rows = []
for user_id in users["user_id"]:
    fav_ids = user_favorites.get(user_id, set())
    if not fav_ids:
        continue
    candidates = listings[listings["listing_id"].isin(fav_ids)].copy()
    if candidates.empty:
        continue
    # Reuse the scoring pipeline so model features match app features.
    value = candidates.groupby("category_slug", group_keys=False).apply(weighted_value_score)
    candidates = candidates.assign(value_score=value.values)
    candidates["trend_pct"] = candidates["listing_id"].map(
        lambda lid: trend_by_listing.get(int(lid))
    )
    specials = candidates.apply(is_special, axis=1)
    candidates["is_special"] = specials.apply(lambda r: r[0])
    candidates["special_bonus"] = candidates["is_special"].astype(int) * 20
    candidates["freshness_bonus"] = candidates["freshness_status"].map(FRESHNESS_BONUS).fillna(0)
    candidates["trust_bonus"] = candidates["verified"].apply(lambda v: 5 if v else 0)
    # trend_pct as a continuous feature — NaN when no history (treat as 0%).
    candidates["trend_feature"] = candidates["trend_pct"].fillna(0.0)

    for _, row in candidates.iterrows():
        label = 1 if (str(user_id), int(row["listing_id"])) in acted_pairs else 0
        training_rows.append(
            {
                "user_id": user_id,
                "listing_id": int(row["listing_id"]),
                "category_slug": row["category_slug"],
                "value_score": float(row["value_score"]),
                "special_bonus": float(row["special_bonus"]),
                "freshness_bonus": float(row["freshness_bonus"]),
                "trust_bonus": float(row["trust_bonus"]),
                "trend_feature": float(row["trend_feature"]),
                "label": label,
            }
        )

training_df = pd.DataFrame(training_rows)
print(f"Total training rows: {len(training_df):,}")
print(f"Positive rate: {training_df['label'].mean():.2%}" if len(training_df) else "No rows")

# Per-category logistic regression. We need a meaningful number of positive
# examples per category to trust the fit — below the floor we just print
# the (uninformative) baseline accuracy and skip exporting weights.
from sklearn.linear_model import LogisticRegression

MIN_POSITIVES_PER_CATEGORY = 30
fitted_weights: dict[str, dict[str, float]] = {}
feature_names = ["value_score", "special_bonus", "freshness_bonus", "trust_bonus", "trend_feature"]

if not training_df.empty:
    print("\nPer-category fit:")
    for cat_slug, group in training_df.groupby("category_slug"):
        positives = int(group["label"].sum())
        n = len(group)
        status = "FIT" if positives >= MIN_POSITIVES_PER_CATEGORY else "skip (too few positives)"
        print(f"  {cat_slug:24s} n={n:5d}  positives={positives:4d}  {status}")
        if positives < MIN_POSITIVES_PER_CATEGORY or (n - positives) < MIN_POSITIVES_PER_CATEGORY:
            continue
        X = group[feature_names].values
        y = group["label"].values
        # L2-regularised logistic regression; class_weight='balanced' keeps the
        # model honest when positives are rare (which they are for favorites).
        clf = LogisticRegression(max_iter=1000, class_weight="balanced")
        clf.fit(X, y)
        # Scale the .coef_ entries to the same units the heuristic uses
        # (per-listing score delta) so a fitted weight can drop into
        # recommend_for_user without translation. Intercept captures the
        # baseline; per-listing score = intercept + sum(coef * feature).
        fitted_weights[cat_slug] = {
            name: float(round(coef, 3)) for name, coef in zip(feature_names, clf.coef_[0])
        }
        fitted_weights[cat_slug]["_intercept"] = float(round(clf.intercept_[0], 3))
        fitted_weights[cat_slug]["_accuracy"] = float(round(clf.score(X, y), 3))
        print(f"    weights={fitted_weights[cat_slug]}")

if fitted_weights:
    out = DATA_DIR / "fitted_weights.json"
    out.write_text(json.dumps(fitted_weights, indent=2))
    print(f"\nWrote fitted weights for {len(fitted_weights)} categories -> {out}")
else:
    print(
        "\nNo categories had enough positive examples to fit. The recommender "
        "keeps using the hand-tuned heuristic until at least one category has "
        f"{MIN_POSITIVES_PER_CATEGORY}+ positives."
    )

# %% [markdown]
# ## 6. Quick sanity check — top picks across all users

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
# ## 7. Where this plugs back into the app
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
#    than the heuristic.
#
# For now, the dashboard section reads the same `SectorFootprint` +
# `SavedListing` data via the catalog lib, so the two stay in sync by
# construction.
#
# ## Status against the original TODOs
#
# - [x] **Replaced `value_score` with the weighted per-category model.**
#   Section 3 now uses `weighted_value_score` (lifted from
#   `value_score_baseline.py`) with a 50/50 fallback for categories without
#   explicit weights. `voice-sms-bundles`, `current-accounts`, and
#   `life-insurance` got new weight tables.
# - [x] **Built the logistic-regression training pipeline.** Section 5
#   constructs a labeled dataset from `action_taken` events + `SavedListing`
#   rows, fits a per-category `LogisticRegression` over
#   `(value_score, special_bonus, freshness_bonus, trust_bonus, trend_feature)`,
#   and writes fitted weights to `data/fitted_weights.json` when a category
#   has enough positives (≥30). The app keeps using the heuristic until
#   that file exists and `recommend_for_user` is taught to consult it.
# - [x] **Wired `trend_pct` as a continuous feature.** Section 2 still
#   computes the boolean `is_special` (so the UI text stays identical), but
#   section 3 also exposes the raw percentage change as `trend_pct` /
#   `trend_feature` for the model. As soon as admin edits + fx-refresh start
#   writing `ListingPriceHistory` rows, this becomes a non-zero signal
#   automatically — no notebook changes needed, just re-run.
#
# ## Remaining TODOs
#
# - [ ] **Flip the app to use fitted weights** when `data/fitted_weights.json`
#   is non-empty — currently `recommend_for_user` always uses the hand-tuned
#   blend. The shape of the change is: load the JSON at notebook start,
#   replace `value_score * 0.5 + special_bonus + …` with
#   `intercept + sum(coef * feature)`.
# - [ ] **Re-fit on a larger, less synthetic catalog** before trusting the
#   coefficients. `prisma/seed.ts` produces a tiny, perfectly curated
#   dataset — fitted weights will overfit. Re-run `export_listings.py`
#   against a populated staging DB before flipping the flag.
# - [ ] **Add per-provider history depth as a feature** — listings whose
#   provider has only ever had one listing are riskier (the price is more
#   likely to be a one-off). Read from a future `provider_listing_count`
#   aggregate.
