import type { SectorSlug } from "@/lib/sectors";

export type CorporatePortalSectorConfig = {
  /** Shown under the company name in the header — a one-line "this is your sector" cue, not a full description. */
  headline: string;
  /** Nav link label overrides keyed by href — same routes, sector-appropriate wording. Unlisted hrefs keep CorporatePortalNav's default label. */
  navLabelOverrides: Partial<Record<string, string>>;
  /** Appended to CORPORATE_SYSTEM_PROMPT in /api/chat so the corporate assistant speaks the sector's own terms. */
  chatPromptFragment: string;
};

/**
 * Per-sector chrome for the corporate portal — the 7 sectors covered by the
 * uploaded 7-sector docs get their own jargon here; every other sector
 * (insurance, healthcare, utilities, pharmacy, electronics, fashion) and a
 * corporate account with no primarySector set fall through to
 * CorporatePortalNav's existing generic copy, unchanged. This is
 * deliberately chrome-only (labels/headline/prompt) — the actual field
 * jargon on the product-edit form already comes from each category's real
 * AttributeSchemaField.label (see prisma/seedData/*), not from here.
 */
export const CORPORATE_PORTAL_CONFIG: Partial<Record<SectorSlug, CorporatePortalSectorConfig>> = {
  banking: {
    headline: "Banking corporate portal",
    navLabelOverrides: {
      "/corporate/products": "Accounts & Products",
      "/corporate/data-import": "Fee Schedule Import",
    },
    chatPromptFragment:
      "This corporate account is a bank. Speak in banking terms — RTGS, Nostro/FCA, USSD, ZIPIT, account tiers, transaction fees — the way a bank's own ops team would.",
  },
  hotels: {
    headline: "Hospitality corporate portal",
    navLabelOverrides: {
      "/corporate/products": "Rooms & Rates",
      "/corporate/data-import": "Rate Sheet Import",
    },
    chatPromptFragment:
      "This corporate account is a hotel. Speak in hospitality terms — room types, rate plans, occupancy, meal plans, booking channels — the way a hotel revenue manager would.",
  },
  transport: {
    headline: "Transport corporate portal",
    navLabelOverrides: {
      "/corporate/products": "Routes & Fares",
      "/corporate/data-import": "Fare Sheet Import",
    },
    chatPromptFragment:
      "This corporate account is a transport operator. Speak in transport terms — routes, fares, fleet, permits, levies — the way an operations manager would.",
  },
  education: {
    headline: "Education corporate portal",
    navLabelOverrides: {
      "/corporate/products": "Fee Schedule",
      "/corporate/data-import": "Fee Import",
    },
    chatPromptFragment:
      "This corporate account is a school or school group. Speak in education-finance terms — SDA, boarding fees, building fund, term fees — the way a school bursar would.",
  },
  food: {
    headline: "Food & drink corporate portal",
    navLabelOverrides: {
      "/corporate/products": "Menu & Pricing",
      "/corporate/data-import": "Menu Import",
    },
    chatPromptFragment:
      "This corporate account is a restaurant/food venue. Speak in food-service terms — menu items, combos, delivery, service speed — the way a restaurant manager would.",
  },
  telecom: {
    headline: "Telecom corporate portal",
    navLabelOverrides: {
      "/corporate/products": "Bundles & Plans",
      "/corporate/data-import": "Bundle Catalog Import",
    },
    chatPromptFragment:
      "This corporate account is a mobile network operator. Speak in telecom terms — bundles, validity, coverage, VAS — the way a telco product manager would.",
  },
  retail: {
    headline: "Retail corporate portal",
    navLabelOverrides: {
      "/corporate/products": "Stock & Pricing",
      "/corporate/data-import": "Price List Import",
    },
    chatPromptFragment:
      "This corporate account is a retailer. Speak in retail terms — SKUs, pack sizes, wholesale vs retail price, shelf price — the way a retail buyer would.",
  },
};

export function getCorporatePortalConfig(sector: SectorSlug | null | undefined): CorporatePortalSectorConfig | null {
  return sector ? (CORPORATE_PORTAL_CONFIG[sector] ?? null) : null;
}

/** Resolves one nav link's label — the sector override if this sector customizes this href, else the link's own default label. */
export function resolveNavLabel(sector: SectorSlug | null | undefined, href: string, defaultLabel: string): string {
  return getCorporatePortalConfig(sector)?.navLabelOverrides[href] ?? defaultLabel;
}
