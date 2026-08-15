import { privateJson } from "@/lib/apiResponse";
import { requireApiKey, requireScope } from "@/lib/bi/auth";
import { getSectorPricingSummary } from "@/lib/pricingIntelligence";
import { LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if ("response" in auth) return auth.response;
  const scopeError = requireScope(auth.apiKey, "read:pricing");
  if (scopeError) return scopeError;

  const sectorParam = new URL(req.url).searchParams.get("sector");
  const sector = sectorParam && (LIVE_SECTORS as readonly string[]).includes(sectorParam) ? (sectorParam as SectorSlug) : undefined;

  const report = await getSectorPricingSummary(sector);
  return privateJson(report);
}
