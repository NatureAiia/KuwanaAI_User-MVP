"""Kuwana — "Traditional comparison" engine.

A plain, rules-based comparator with **no AI / LLM in the loop**. It mirrors
the transparent heuristics the notebooks use (`recommendation_engine.py` /
`value_score_baseline.py`): a per-category weighted value score, then small
bonuses for special (trending-down / below-median), freshness and verified
providers. Everything is printed in plain text so the app can show exactly
what the engine "thinks" — no black box.

Reads one JSON object from stdin:

    {
      "category_name": "Data bundles",
      "category_slug": "data-bundles",
      "attribute_schema": [
        {"key": "data_amount", "label": "Data", "data_type": "number",
         "unit": "GB", "is_comparable": true, "sort_order": 1}
      ],
      "listings": [
        {
          "id": "...", "name": "...", "provider": "...",
          "provider_verified": true, "price": 5.0, "currency": "USD",
          "attributes": {"data_amount": 5, "validity_days": 30},
          "freshness_status": "fresh",
          "trend_percent": -12.0
        }
      ]
    }

Prints one JSON object to stdout: `{"text": "<human-readable dump>",
"winner": {"name", "score", "why"} | null, "runner_ups": [{"name", "score"}],
"note": "<disclaimer>" | null}`. `text` keeps the full human-readable
breakdown (audit trail / debugging); the other fields are what the app
renders as structured UI instead of dumping `text` verbatim. Uses only the
standard library so it runs anywhere Python 3.8+ is installed — no
pandas/sklearn needed at request time.

Run directly to smoke-test:

    python scripts/traditional_compare.py < sample.json
"""

import json
import sys

# Per-category weights, lifted from notebooks/recommendation_engine.py so the
# on-demand engine agrees with the offline recommender. Categories without an
# entry fall back to the legacy 50/50 price + first-numeric-benefit blend.
CATEGORY_WEIGHTS: dict[str, dict[str, float]] = {
    "data-bundles": {"price": 0.4, "data_amount": 0.4, "validity_days": 0.2},
    "voice-sms-bundles": {"price": 0.35, "minutes": 0.35, "sms_count": 0.2, "validity_days": 0.1},
    "savings-accounts": {"price": 0.3, "interest_rate": 0.4, "monthly_fee": 0.3},
    "current-accounts": {"price": 0.4, "transaction_fee": 0.3, "branch_count": 0.3},
    "motor-insurance": {"price": 0.35, "coverage_amount": 0.45, "claim_turnaround_days": 0.2},
    "life-insurance": {"price": 0.3, "coverage_amount": 0.4, "payout_speed_days": 0.3},
}

FRESHNESS_BONUS = {"fresh": 5, "stale": -6, "unverified": -12}
SPECIAL_BONUS = 20
TRUST_BONUS = 5
TREND_DROP_THRESHOLD = -5.0
BELOW_MEDIAN_FACTOR = 0.9

BAR = "=" * 60


def speak(reasons: list[str]) -> str:
    """Joins reason phrases into one plain sentence: "A", "A and B", or
    "A, B, and C" — read-aloud-friendly instead of a semicolon-delimited log."""
    if not reasons:
        return ""
    if len(reasons) == 1:
        return reasons[0]
    if len(reasons) == 2:
        return f"{reasons[0]} and {reasons[1]}"
    return ", ".join(reasons[:-1]) + f", and {reasons[-1]}"


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize(values: list[float], invert: bool) -> list[float]:
    lo, hi = min(values), max(values)
    if lo == hi:
        return [100.0 for _ in values]
    return [round((1 - (v - lo) / (hi - lo)) * 100, 1) if invert else round(((v - lo) / (hi - lo)) * 100, 1) for v in values]


def first_numeric_benefit_key(schema: list[dict]) -> str | None:
    numeric = [a for a in schema if a.get("data_type") == "number" and a.get("is_comparable") and a.get("key") != "price"]
    numeric = sorted(numeric, key=lambda a: a.get("sort_order", 0))
    return numeric[0]["key"] if numeric else None


def fmt_attr(listing: dict, key: str, schema: list[dict]) -> str:
    value = listing.get("attributes", {}).get(key)
    if value is None:
        return "—"
    field = next((a for a in schema if a["key"] == key), None)
    unit = field.get("unit") if field else None
    return f"{value} {unit}".strip() if unit else f"{value}"


def compute_value_score(
    listing: dict,
    category_slug: str,
    schema: list[dict],
    prices: list[float],
    compared_set: list[dict],
) -> tuple[float, str]:
    weights = CATEGORY_WEIGHTS.get(category_slug)
    attrs = listing.get("attributes", {})
    price = _num(listing.get("price"))
    if price is None:
        return 0.0, "no price"

    price_scores = normalize(prices, invert=True)
    price_score = price_scores[prices.index(price)] if price in prices else 100.0

    def _column(key: str) -> list[float]:
        return [v for v in (_num(l.get("attributes", {}).get(key)) for l in compared_set) if v is not None]

    def _score_against_set(key: str) -> float:
        col = _column(key)
        raw = _num(attrs.get(key))
        if raw is None or len(col) < 2:
            return 100.0
        norm = normalize(col, invert=False)
        return norm[col.index(raw)] if raw in col else 100.0

    if weights:
        parts: list[float] = []
        breakdown: list[str] = []
        for key, weight in weights.items():
            if key == "price":
                parts.append(price_score * weight)
                breakdown.append(f"price {weight:.0%}")
                continue
            raw = _num(attrs.get(key))
            if raw is None:
                continue
            parts.append(_score_against_set(key) * weight)
            breakdown.append(f"{key} {weight:.0%}")
        if parts:
            score = round(sum(parts), 1)
            return score, " · ".join(breakdown)
        return price_score, "price only"

    benefit_key = first_numeric_benefit_key(schema)
    if benefit_key is None:
        return price_score, "price only (no benefit attribute)"
    raw = _num(attrs.get(benefit_key))
    if raw is None:
        return price_score, "price only"
    benefit_score = _score_against_set(benefit_key)
    total = round(price_score * 0.5 + benefit_score * 0.5, 1)
    return total, "price 50% · benefit 50%"


def run(payload: dict) -> dict:
    category_name = payload.get("category_name") or "Unknown"
    category_slug = payload.get("category_slug") or ""
    schema = payload.get("attribute_schema") or []
    listings = payload.get("listings") or []
    if len(listings) < 1:
        return {"text": "No listings to compare.\n", "winner": None, "runner_ups": [], "note": None}

    prices = [_num(l.get("price")) for l in listings]
    prices = [p for p in prices if p is not None]
    if not prices:
        prices = [0.0 for _ in listings]

    median_price = sorted(prices)[len(prices) // 2] if prices else 0.0

    scored: list[dict] = []
    for listing in listings:
        value_score, blend = compute_value_score(listing, category_slug, schema, prices, listings)

        # Plain, spoken-out-loud phrasing on purpose — this is the sentence
        # shown directly to the user as "Why", so it needs to read like an
        # explanation a ten-year-old would follow, not a scoring log. The
        # actual math (weights, bonuses) still lives in the full text dump
        # below for anyone who wants the audit trail.
        reasons: list[str] = []
        special = False
        trend = _num(listing.get("trend_percent"))
        if trend is not None and trend <= TREND_DROP_THRESHOLD:
            special = True
            reasons.append(f"its price just dropped {abs(trend):.0f}%, so it's cheaper than it was recently")
        price = _num(listing.get("price"))
        if price is not None and median_price > 0 and price <= median_price * BELOW_MEDIAN_FACTOR:
            special = True
            reasons.append("it costs less than most of the other options here")

        freshness = listing.get("freshness_status") or "unverified"
        freshness_bonus = FRESHNESS_BONUS.get(freshness, 0)
        if freshness_bonus > 0:
            reasons.append("the price we have for it is fresh and up to date")
        elif freshness == "stale":
            reasons.append("the price we have for it is a bit old, so it may have changed")
        elif freshness == "unverified":
            reasons.append("we haven't double-checked this price recently")

        verified = bool(listing.get("provider_verified"))
        trust_bonus = TRUST_BONUS if verified else 0
        if not verified:
            reasons.append("its provider hasn't been verified yet, so it's worth double-checking")

        bonus = SPECIAL_BONUS if special else 0

        final = max(0.0, min(100.0, round(value_score + bonus + freshness_bonus + trust_bonus, 1)))

        scored.append(
            {
                "listing": listing,
                "value_score": value_score,
                "blend": blend,
                "final": final,
                "bonus": bonus,
                "freshness_bonus": freshness_bonus,
                "trust_bonus": trust_bonus,
                "reasons": reasons,
            }
        )

    scored.sort(key=lambda s: s["final"], reverse=True)

    lines: list[str] = []
    lines.append(BAR)
    lines.append("TRADITIONAL COMPARISON — rules-based engine, no AI")
    lines.append(f"Category: {category_name}")
    lines.append("Weights: transparent per-category value blend + special/freshness/trust bonuses")
    lines.append(BAR)

    for rank, entry in enumerate(scored, start=1):
        listing = entry["listing"]
        provider = listing.get("provider") or "Unknown provider"
        lines.append("")
        lines.append(f"{rank}. {listing.get('name') or 'Unnamed'}  ({provider})")
        price = _num(listing.get("price"))
        currency = listing.get("currency") or ""
        price_txt = f"{price:,.2f} {currency}".strip() if price is not None else "price —"
        lines.append(f"   Price: {price_txt}")
        for attr in schema:
            if attr.get("is_comparable") and attr.get("key") != "price" and attr.get("data_type") == "number":
                if _num(listing.get("attributes", {}).get(attr["key"])) is not None:
                    lines.append(f"   {attr.get('label') or attr['key']}: {fmt_attr(listing, attr['key'], schema)}")
        lines.append(f"   Value score: {entry['value_score']}/100  ({entry['blend']})")
        detail = f"   Adjustments: special +{entry['bonus']}" if entry["bonus"] else "   Adjustments: none"
        detail += f" · freshness {entry['freshness_bonus']:+d} · trust {entry['trust_bonus']:+d}"
        lines.append(detail)
        lines.append(f"   FINAL: {entry['final']}/100")
        if entry["reasons"]:
            lines.append("   Because: " + speak(entry["reasons"]))

    lines.append("")
    lines.append(BAR)
    winner = scored[0]
    winner_why = speak(winner["reasons"]) if winner["reasons"] else "it scored best overall once we weighed price and features fairly"
    lines.append(f"WINNER: {winner['listing'].get('name')} — {winner['final']}/100")
    lines.append(f"Why: {winner_why}.")

    runner_ups = [
        {"name": s["listing"].get("name") or "Unnamed", "score": s["final"]}
        for s in scored[1:3]
    ]
    if runner_ups:
        lines.append("")
        lines.append("Runner-up: " + " — ".join(f"{r['name']} ({r['score']}/100)" for r in runner_ups))

    note = "This is a deterministic rules-based comparison, not an AI recommendation."
    lines.append("")
    lines.append(f"Note: {note[0].lower()}{note[1:]}")

    return {
        "text": "\n".join(lines) + "\n",
        "winner": {
            "name": winner["listing"].get("name") or "Unnamed",
            "score": winner["final"],
            "why": winner_why,
        },
        "runner_ups": runner_ups,
        "note": note,
    }


if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"could not read JSON payload: {exc}"}), file=sys.stderr)
        sys.exit(1)
    print(json.dumps(run(payload)))
