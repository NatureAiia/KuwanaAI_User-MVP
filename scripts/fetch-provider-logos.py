"""Fetch carrier/provider logos from each company's official website.

One-off: ran once to populate `public/provider-logos/`. Re-run only when
adding a new provider, or to refresh stale assets. Not part of the app's
runtime path.

Sources (each company's own site, public marketing/press kit assets where
possible; Wikipedia as a fallback for carriers that don't host a
downloadable logo on their public site):

  Telecel    https://www.telecel.co.zw/  -> Wikipedia
  Econet     https://www.econet.co.zw/   -> Wikipedia
  NetOne     https://www.netone.co.zw/   -> Wikipedia
  CBZ        https://www.cbz.co.zw/
  Steward    https://www.stewardbank.co.zw/
  Stanbic    https://www.stanbic.co.zw/
  FBC        https://www.fbc.co.zw/
  ZB         https://www.zbbank.co.zw/
  Nedbank    https://www.nedbank.co.zw/
  Old Mutual https://www.oldmutual.co.zw/
  First Mutual https://www.firstmutual.co.zw/
  ZIMNAT     https://www.zimnat.co.zw/
  Fidelity Life https://www.fidelitylife.co.zw/
  Cimas      https://www.cimas.co.zw/
  PSMAS      https://www.psmas.co.zw/

Run from the repo root:

    pip install requests beautifulsoup4
    python scripts/fetch-provider-logos.py

Writes into `public/provider-logos/<slug>.svg` (or .png if SVG not
available). Falls back to a Wikipedia favicon if the company's own site
serves no logo asset — better than nothing, and the ProviderLogo
component already has a colored-initials fallback if the file is missing.
"""

import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "provider-logos"
OUT_DIR.mkdir(parents=True, exist_ok=True)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


# Each entry: (provider slug used in DB, homepage URL, asset hint).
# `asset` is a regex matched against <img src=...> URLs on the homepage;
# the first hit wins. `prefer` lets us prefer .svg over .png if both exist.
PROVIDERS: list[tuple[str, str, str, str]] = [
    # slug, homepage, asset regex, preferred extension
    ("telecel", "https://www.telecel.co.zw/", r"logo|brand|wordmark", "svg"),
    ("econet", "https://www.econet.co.zw/", r"logo|brand|wordmark", "svg"),
    ("netone", "https://www.netone.co.zw/", r"logo|brand|wordmark", "svg"),
    ("cbz-bank", "https://www.cbz.co.zw/", r"logo|brand|wordmark", "svg"),
    ("steward-bank", "https://www.stewardbank.co.zw/", r"logo|brand|wordmark", "svg"),
    ("stanbic", "https://www.stanbic.co.zw/", r"logo|brand|wordmark", "svg"),
    ("fbc", "https://www.fbc.co.zw/", r"logo|brand|wordmark", "svg"),
    ("zb-bank", "https://www.zbbank.co.zw/", r"logo|brand|wordmark", "svg"),
    ("nedbank", "https://www.nedbank.co.zw/", r"logo|brand|wordmark", "svg"),
    ("old-mutual", "https://www.oldmutual.co.zw/", r"logo|brand|wordmark", "svg"),
    ("first-mutual", "https://www.firstmutual.co.zw/", r"logo|brand|wordmark", "svg"),
    ("zimnat", "https://www.zimnat.co.zw/", r"logo|brand|wordmark", "svg"),
    ("fidelity-life", "https://www.fidelitylife.co.zw/", r"logo|brand|wordmark", "svg"),
    ("cimas", "https://www.cimas.co.zw/", r"logo|brand|wordmark", "svg"),
    ("psmas", "https://www.psmas.co.zw/", r"logo|brand|wordmark", "svg"),
]


# Wikipedia fallback for carriers whose own sites don't expose a logo asset
# under a stable URL (most Zimbabwean carriers serve their logo via inline
# CSS background-image, which we can't fetch from HTML alone). The
# Wikipedia commons logos are public-domain or freely-licensed marks hosted
# under a stable URL.
WIKI_FALLBACKS: dict[str, str] = {
    "telecel": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Telecel_Logo.svg/240px-Telecel_Logo.svg.png",
    "econet": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Econet_Wireless_logo.svg/240px-Econet_Wireless_logo.svg.png",
    "netone": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/NetOne_Logo.svg/240px-NetOne_Logo.svg.png",
}


def fetch_html(url: str, timeout: int = 15) -> str | None:
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=timeout, allow_redirects=True)
        r.raise_for_status()
        return r.text
    except requests.RequestException as e:
        print(f"  ! could not fetch {url}: {e}")
        return None


def find_logo_url(html: str, base: str, pattern: str, prefer: str) -> str | None:
    """Scan <img> tags for a logo-like URL. Picks the first match in document
    order, preferring the requested extension if both exist."""
    soup = BeautifulSoup(html, "html.parser")
    candidates: list[tuple[str, str]] = []  # (priority, url)
    rx = re.compile(pattern, re.I)
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src")
        if not src:
            continue
        full = urljoin(base, src)
        if not rx.search(full):
            continue
        ext = Path(urlparse(full).path).suffix.lower().lstrip(".")
        priority = 0 if ext == prefer else 1
        candidates.append((priority, full))
    if not candidates:
        return None
    candidates.sort(key=lambda t: t[0])
    return candidates[0][1]


def download(url: str, dest: Path, timeout: int = 15) -> bool:
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=timeout, stream=True)
        r.raise_for_status()
        content_type = r.headers.get("content-type", "").lower()
        if not any(t in content_type for t in ("image/", "application/octet-stream", "binary/")):
            print(f"  ! refusing non-image content-type {content_type!r} from {url}")
            return False
        with open(dest, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return True
    except requests.RequestException as e:
        print(f"  ! could not download {url}: {e}")
        return False


def main() -> int:
    results: list[tuple[str, str]] = []  # (slug, status)
    for slug, homepage, pattern, prefer in PROVIDERS:
        target = OUT_DIR / f"{slug}.svg"
        print(f"-> {slug} ({homepage})")
        html = fetch_html(homepage)
        logo_url: str | None = None
        if html:
            logo_url = find_logo_url(html, homepage, pattern, prefer)
        if not logo_url:
            logo_url = WIKI_FALLBACKS.get(slug)
            if logo_url:
                print(f"  using Wikipedia fallback: {logo_url}")
        if not logo_url:
            results.append((slug, "MISSING"))
            continue
        # Adjust destination extension to match the actual response.
        ext = Path(urlparse(logo_url).path).suffix.lower() or f".{prefer}"
        dest = OUT_DIR / f"{slug}{ext}"
        ok = download(logo_url, dest)
        results.append((slug, "OK" if ok else "FAILED"))
        time.sleep(0.5)  # be polite

    print("\nSummary:")
    for slug, status in results:
        print(f"  {slug:18s} {status}")

    print(f"\nWrote {len(list(OUT_DIR.iterdir()))} files to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
