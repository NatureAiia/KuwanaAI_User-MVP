"""Export the current catalog (listings + attribute schema) to CSV for notebook use.

Reads DATABASE_URL the same way the Next.js app does (repo-root .env), so this
always reflects whatever Postgres the app is currently pointed at — local,
Supabase, whatever. Run from the notebooks/ directory:

    source .venv/bin/activate
    python export_listings.py

Writes listings.csv and attribute_schema.csv into notebooks/data/.
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
    """Prisma's DATABASE_URL carries a `schema` query param psycopg2 doesn't
    understand — strip it (we only ever query the default `public` schema)."""
    parsed = urlparse(prisma_url)
    query = parse_qs(parsed.query)
    query.pop("schema", None)
    return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))


DATABASE_URL = to_psycopg2_dsn(os.environ["DATABASE_URL"])

LISTINGS_QUERY = """
select
    l.id as listing_id,
    l.name as listing_name,
    l.price,
    l.currency,
    l.attributes,
    l.freshness_status,
    l.last_verified_at,
    p.name as provider_name,
    c.id as category_id,
    c.slug as category_slug,
    c.name as category_name,
    s.slug as sector_slug,
    s.name as sector_name
from listings l
join providers p on p.id = l.provider_id
join categories c on c.id = l.category_id
join sectors s on s.id = c.sector_id
order by s.slug, c.slug, l.price;
"""

ATTRIBUTE_SCHEMA_QUERY = """
select
    a.category_id,
    c.slug as category_slug,
    a.key,
    a.label,
    a.data_type,
    a.unit,
    a.is_comparable,
    a.sort_order
from attribute_schema a
join categories c on c.id = a.category_id
order by c.slug, a.sort_order;
"""


def export():
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)

    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(LISTINGS_QUERY)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

        listings_path = out_dir / "listings.csv"
        with open(listings_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(columns)
            for row in rows:
                row = list(row)
                attrs_idx = columns.index("attributes")
                row[attrs_idx] = json.dumps(row[attrs_idx])
                writer.writerow(row)
        print(f"Wrote {len(rows)} listings -> {listings_path}")

        with conn.cursor() as cur:
            cur.execute(ATTRIBUTE_SCHEMA_QUERY)
            columns = [desc[0] for desc in cur.description]
            rows = cur.fetchall()

        schema_path = out_dir / "attribute_schema.csv"
        with open(schema_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(columns)
            writer.writerows(rows)
        print(f"Wrote {len(rows)} attribute_schema rows -> {schema_path}")


if __name__ == "__main__":
    export()
