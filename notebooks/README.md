# Kuwana — modeling workstream

A Python/Jupyter environment, separate from the Next.js app, for prototyping the scoring/
forecasting models described in `KUWANA_DECISION_INTELLIGENCE_PLAN.md` (items 8–10: the value-
score model, and eventually the price-trend forecast behind `/trends`). This does **not** run in
production — it's an experimentation space that reads a snapshot of the app's own database and
proposes improvements to `src/lib/scoring.ts`, not a service the app calls.

## Setup

```bash
cd notebooks
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Usage

1. **Export the current catalog** from whatever Postgres `DATABASE_URL` (repo-root `.env`) points
   at — local, Supabase, wherever the app is currently configured:

   ```bash
   python export_listings.py
   ```

   Writes `data/listings.csv` and `data/attribute_schema.csv` (gitignored — always regenerate
   rather than committing a stale snapshot).

2. **Open the notebook**:

   ```bash
   jupyter lab value_score_baseline.ipynb
   ```

   Verified to execute cleanly end-to-end (`jupyter nbconvert --execute`) against the seeded MVP
   catalog as of this commit.

## Why both a `.py` and a `.ipynb`

`value_score_baseline.py` is the source of truth, in
[jupytext "percent" format](https://jupytext.readthedocs.io/) (`# %%` cell markers) — plain
Python, diffable in code review, no notebook JSON noise. `value_score_baseline.ipynb` is generated
from it (`jupytext --to notebook value_score_baseline.py`) for anyone who wants to open it
directly in Jupyter/VS Code. If you edit the notebook interactively, sync back with:

```bash
jupytext --to py:percent value_score_baseline.ipynb -o value_score_baseline.py
```

## What's actually in here right now

`value_score_baseline.py` reproduces the TS heuristic from `src/lib/scoring.ts` in Python (so
there's a Python-side baseline to compare against), then fits a *weighted* version where each
category's comparable attributes each get a tunable weight instead of a fixed 50/50 price/benefit
split. It is **not yet a trained model** — there's no labeled "this was the best listing" signal
in the data yet. The TODOs at the bottom of the notebook spell out what that signal should be
(saved/chosen listings out of a comparison set) and how a real fitted model would plug back into
`src/lib/scoring.ts` once it exists.

## Out of scope here (see the plan doc)

- Serving this as a live model behind `/api/recommendations` — not until there's a model worth
  serving (see the notebook's "where this plugs back in" section).
- Fine-tuning an LLM — a separate, later workstream once there's enough real usage data.
- The `/trends` forecasting page's actual forecast — blocked on `listing_price_history` actually
  being populated first (see the plan doc's price-drop-alerts item).
