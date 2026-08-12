"""Export per-user signal (users, profiles, footprints, saves, comparisons) to CSV.

Companion to `export_listings.py` — runs the same DATABASE_URL plumbing and
writes per-user CSVs that `recommendation_engine.py` reads alongside the
catalog. Kept separate from `export_listings.py` because the user-signal
tables are bigger and noisier; this lets you refresh just the catalog (when
a new listing is added) without re-dumping every user's history.

Run from notebooks/:

    python export_user_signals.py

Writes users.csv, user_profiles.csv, sector_footprints.csv,
saved_listings.csv, comparisons.csv, listing_price_history.csv into
notebooks/data/.
"""

import csv
import json
import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlunparse, urlencode

import psycopg2
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")


def to_psycopg2_dsn(prisma_url: str) -> str:
    parsed = urlparse(prisma_url)
    query = parse_qs(parsed.query)
    query.pop("schema", None)
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))


DATABASE_URL = to_psycopg2_dsn(os.environ["DATABASE_URL"])

# `data` is a JSONB column; psycopg2 returns it as a Python object so we just
# json.dumps it back to text for a flat CSV. Same trick export_listings.py
# uses for listings.attributes.
USERS_QUERY = """
select id as user_id, email, role, created_at
from users
order by created_at;
"""

PROFILES_QUERY = """
select user_id, age_range, occupation, location, full_name, nickname
from user_profiles;
"""

FOOTPRINTS_QUERY = """
select user_id, sector, data
from sector_footprints
order by user_id, sector;
"""

SAVED_QUERY = """
select user_id, listing_id, saved_at
from saved_listings
order by saved_at desc;
"""

COMPARISONS_QUERY = """
select id as comparison_id, user_id, category_id, listing_ids, created_at
from comparisons
order by created_at desc;
"""

PRICE_HISTORY_QUERY = """
select listing_id, price, recorded_at
from listing_price_history
order by listing_id, recorded_at;
"""


QUERIES: list[tuple[str, str]] = [
    ("users.csv", USERS_QUERY),
    ("user_profiles.csv", PROFILES_QUERY),
    ("sector_footprints.csv", FOOTPRINTS_QUERY),
    ("saved_listings.csv", SAVED_QUERY),
    ("comparisons.csv", COMPARISONS_QUERY),
    ("listing_price_history.csv", PRICE_HISTORY_QUERY),
]


def export():
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)

    with psycopg2.connect(DATABASE_URL) as conn:
        for filename, query in QUERIES:
            with conn.cursor() as cur:
                cur.execute(query)
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
            out_path = out_dir / filename
            with open(out_path, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(columns)
                for row in rows:
                    row = list(row)
                    # Footprints have a JSONB `data` column; comparisons have
                    # a list-typed `listing_ids`; both need json.dumps to land
                    # in a CSV as text.
                    for i, value in enumerate(row):
                        if isinstance(value, (dict, list)):
                            row[i] = json.dumps(value)
                    writer.writerow(row)
            print(f"Wrote {len(rows)} rows -> {out_path}")


if __name__ == "__main__":
    export()
