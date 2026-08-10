/**
 * Map a Provider.name (the human-readable label shown everywhere in the app)
 * to the slug under which we store its logo asset in `public/provider-logos/`.
 *
 * The slug is intentionally separate from the DB id: provider ids in the
 * schema are UUIDs assigned at seed time and aren't stable across re-seeds,
 * but the slugs here are deliberately stable strings so the seed file can
 * reference them, the homepage can hard-link them, and the dev script
 * (scripts/fetch-provider-logos.py) can write into a known path.
 *
 * Falls back to `null` when no logo is on disk for that provider — the
 * `ProviderLogo` component handles the null case by rendering colored
 * initials instead, so adding a new provider is a no-op until someone
 * drops a logo into `public/provider-logos/`.
 */
export function providerLogoSlug(name: string): string | null {
  const key = name.toLowerCase().trim();
  // Hand-curated table — keeps the mapping explicit rather than guessing.
  // Add an entry here when you add a new provider, then drop the logo file
  // into public/provider-logos/<slug>.<ext>.
  const SLUGS: Record<string, string> = {
    // Telecom
    econet: "econet",
    netone: "netone",
    "net one": "netone",
    telecel: "telecel",
    // Banking
    cbz: "cbz-bank",
    "cbz bank": "cbz-bank",
    steward: "steward-bank",
    "steward bank": "steward-bank",
    fbc: "fbc",
    stanbic: "stanbic",
    "zb bank": "zb-bank",
    zb: "zb-bank",
    nedbank: "nedbank",
    posb: "posb",
    // Insurance
    "old mutual": "old-mutual",
    "first mutual": "first-mutual",
    zimnat: "zimnat",
    "fidelity life": "fidelity-life",
    fidelity: "fidelity-life",
    // Healthcare
    cimas: "cimas",
    psmas: "psmas",
    "first mutual health": "first-mutual",
  };
  return SLUGS[key] ?? null;
}

/** Files we know we have on disk — used by the signup chips so we don't
 *  render a broken <img> for providers whose logo we couldn't fetch. */
const KNOWN_EXTENSIONS: Record<string, "png" | "svg"> = {
  econet: "png",
  netone: "png",
  telecel: "png",
  "cbz-bank": "png",
  "steward-bank": "png",
  fbc: "png",
  stanbic: "png",
  "zb-bank": "png",
  nedbank: "svg",
  posb: "png",
  "old-mutual": "png",
  "first-mutual": "png",
  zimnat: "png",
  "fidelity-life": "png",
  cimas: "svg",
  psmas: "png",
};

export function providerLogoUrl(name: string): string | null {
  const slug = providerLogoSlug(name);
  if (!slug) return null;
  const ext = KNOWN_EXTENSIONS[slug];
  if (!ext) return null;
  return `/provider-logos/${slug}.${ext}`;
}
