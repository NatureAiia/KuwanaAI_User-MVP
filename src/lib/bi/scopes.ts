/**
 * Scope vocabulary for ApiKey.scopes. The model has carried a bare
 * `String[]` since it was added (see schema.prisma's ApiKey comment) with no
 * defined vocabulary — this is that vocabulary. Every scope is read-only;
 * there is no write surface on the BI API.
 */
export const BI_SCOPES = [
  "read:market",
  "read:pricing",
  "read:economic",
  "read:conditions",
  "read:sentiment",
  // Only usable by a key with a linked provider — /api/bi/v1/my-account
  // rejects this scope on a platform-wide key even if somehow granted.
  "read:account",
] as const;

export type BiScope = (typeof BI_SCOPES)[number];

export const BI_SCOPE_LABELS: Record<BiScope, string> = {
  "read:market": "Market overview — sector-wide price/trend rollups",
  "read:pricing": "Pricing intelligence — outlier/peer pricing signals",
  "read:economic": "Economic drivers — FX rate, inflation, and other macro indicators",
  "read:conditions": "Business conditions — regulatory/competitor/macro items being tracked",
  "read:sentiment": "Sentiment — social mention sentiment rollup",
  "read:account": "My account (provider-scoped keys only) — own fee comparison, competitor watch, sentiment",
};

export function isBiScope(value: string): value is BiScope {
  return (BI_SCOPES as readonly string[]).includes(value);
}
