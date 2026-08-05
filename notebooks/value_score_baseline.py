# %% [markdown]
# # Kuwana — value-score baseline model
#
# `src/lib/scoring.ts` in the app computes a value score with a fixed 50/50
# blend of normalized price and the first comparable numeric "benefit"
# attribute. That heuristic is deliberately simple (Section 9 of the build
# plan: no invented statistics, everything traces to real listing fields).
#
# This notebook is the first step towards Section 8/9 of the UI/UX plan —
# replacing that fixed heuristic with a learned model, and eventually a
# fine-tuned model. Right now there is no ground-truth "this is the best
# listing" label to train against, so this notebook:
#
# 1. Reproduces the TS heuristic in Python on the exported catalog, as a
#    baseline to beat.
# 2. Fits a simple weighted model (`sklearn.preprocessing.MinMaxScaler` +
#    a configurable weight vector per category) so the weighting is no
#    longer hardcoded 50/50 — it's a parameter you can tune per category
#    once real user feedback (saves, "chose this one" signals) exists.
# 3. Leaves clearly marked TODOs for where a real training signal
#    (comparison outcomes, saved listings, click-through) plugs in.
#
# Run `python export_listings.py` first to refresh `data/*.csv` from
# whatever database `DATABASE_URL` points at.
#
# This file is a plain Python script in the "jupytext percent" format —
# open it directly in Jupyter/VS Code as a notebook (each `# %%` is a
# cell), or run it top-to-bottom with `python value_score_baseline.py`.

# %%
import json
from pathlib import Path

import pandas as pd
from sklearn.preprocessing import MinMaxScaler

DATA_DIR = Path.cwd() / "data"  # run Jupyter with cwd = notebooks/

listings = pd.read_csv(DATA_DIR / "listings.csv")
listings["attributes"] = listings["attributes"].apply(json.loads)
schema = pd.read_csv(DATA_DIR / "attribute_schema.csv")

print(f"{len(listings)} listings across {listings['category_slug'].nunique()} categories")
listings.head()

# %% [markdown]
# ## 1. Reproduce the TS heuristic
#
# Mirrors `computeValueScores` in `src/lib/scoring.ts`: normalize price
# (lower is better) and the first comparable numeric non-price attribute
# (higher is better), blend 50/50.


# %%
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


def apply_per_category(df: pd.DataFrame, func) -> pd.Series:
    """Runs `func(group, category_slug)` per category and stitches the
    resulting Series back together, index-aligned with `df`. Avoids relying
    on pandas' groupby.apply column-retention behavior, which differs across
    versions when the callback returns a Series rather than a scalar."""
    parts = [func(group, category_slug) for category_slug, group in df.groupby("category_slug")]
    return pd.concat(parts).reindex(df.index)


def ts_heuristic_scores(group: pd.DataFrame, category_slug: str) -> pd.Series:
    benefit_key = first_numeric_benefit_key(category_slug)

    price_score = normalize(group["price"], invert=True)
    if benefit_key is None:
        return price_score.round().astype(int)

    benefit_values = group["attributes"].apply(lambda a: a.get(benefit_key))
    benefit_values = pd.to_numeric(pd.Series(benefit_values, index=group.index), errors="coerce")
    benefit_score = normalize(benefit_values.fillna(benefit_values.mean()), invert=False)

    return (price_score * 0.5 + benefit_score * 0.5).round().astype(int)


listings["ts_heuristic_score"] = apply_per_category(listings, ts_heuristic_scores)
listings[["category_slug", "listing_name", "price", "ts_heuristic_score"]].sort_values(
    ["category_slug", "ts_heuristic_score"], ascending=[True, False]
)

# %% [markdown]
# ## 2. Weighted model — same idea, tunable weights instead of a fixed 50/50
#
# This is still a heuristic, not a trained model — there's no labeled
# "best" listing to fit against yet (see TODOs below). What it adds over
# the TS version: every comparable numeric attribute contributes (not just
# the first one), each with its own weight, so it's a real parameter
# surface to tune once feedback data exists.


# %%
# TODO(real training signal): once `user_events`/`comparisons`/`saved_listings`
# have enough volume, replace CATEGORY_WEIGHTS with weights *fit* from data —
# e.g. logistic regression predicting "was this listing saved/chosen" from its
# normalized attributes, per category. For now these are illustrative defaults.
CATEGORY_WEIGHTS = {
    "data-bundles": {"price": 0.4, "data_amount": 0.4, "validity_days": 0.2},
    "savings-accounts": {"price": 0.3, "interest_rate": 0.4, "monthly_fee": 0.3},
    "motor-insurance": {"price": 0.35, "coverage_amount": 0.45, "claim_turnaround_days": 0.2},
}


def weighted_scores(group: pd.DataFrame, category_slug: str) -> pd.Series:
    weights = CATEGORY_WEIGHTS.get(category_slug)
    if not weights:
        return ts_heuristic_scores(group, category_slug)  # fall back to the TS heuristic

    total = pd.Series(0.0, index=group.index)
    for key, weight in weights.items():
        if key == "price":
            values = group["price"]
            invert = True
        else:
            values = pd.to_numeric(
                group["attributes"].apply(lambda a: a.get(key)), errors="coerce"
            )
            invert = False
        total += normalize(values.fillna(values.mean()), invert=invert) * weight

    return total.round().astype(int)


listings["weighted_score"] = apply_per_category(listings, weighted_scores)
listings[
    ["category_slug", "listing_name", "price", "ts_heuristic_score", "weighted_score"]
].sort_values(["category_slug", "weighted_score"], ascending=[True, False])

# %% [markdown]
# ## 3. Where this plugs back into the app
#
# Not wired up yet — this notebook is a prototyping space, not a serving
# path. Two ways to close the loop later, once a category's weights (or a
# genuinely trained model) are worth shipping:
#
# 1. **Batch export**: dump `{category_slug: weights}` to a JSON file the
#    Next.js app reads at build/deploy time, and swap `computeValueScores`
#    in `src/lib/scoring.ts` to look up weights per category instead of the
#    fixed 50/50 blend. No new service required.
# 2. **Live model serving** (once there's a real trained model, not just
#    tuned weights): a small FastAPI service in this same `notebooks/`
#    environment, called from `/api/recommendations` alongside the Claude
#    call. Only worth it once the model is doing something a
#    weights-lookup can't (e.g. a fitted regression, or the fine-tuned
#    model from the UI/UX plan's roadmap).
#
# ## TODOs before this is more than a toy
#
# - [ ] Instrument a real training signal: which listing did the user
#   ultimately save/act on out of the set they compared? That's the label.
# - [ ] Once `listing_price_history` is actually being written to (see the
#   UI/UX plan's price-drop-alerts item), add price *trend* as a feature —
#   this is also the data the `/trends` forecasting page will need.
# - [ ] Re-run `export_listings.py` against a larger, less synthetic catalog
#   before trusting any fitted weights.
