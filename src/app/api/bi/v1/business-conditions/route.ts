import { privateJson } from "@/lib/apiResponse";
import { requireApiKey, requireScope } from "@/lib/bi/auth";
import { getActiveBusinessConditions } from "@/lib/businessConditions";
import { LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if ("response" in auth) return auth.response;
  const scopeError = requireScope(auth.apiKey, "read:conditions");
  if (scopeError) return scopeError;

  const sectorParam = new URL(req.url).searchParams.get("sector");
  const sector = sectorParam && (LIVE_SECTORS as readonly string[]).includes(sectorParam) ? (sectorParam as SectorSlug) : undefined;

  const conditions = await getActiveBusinessConditions(sector);
  return privateJson({ conditions });
}
