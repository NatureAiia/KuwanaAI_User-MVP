import { privateJson } from "@/lib/apiResponse";
import { requireApiKey, requireScope } from "@/lib/bi/auth";
import { getLatestEconomicDrivers } from "@/lib/economicDrivers";

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if ("response" in auth) return auth.response;
  const scopeError = requireScope(auth.apiKey, "read:economic");
  if (scopeError) return scopeError;

  const region = new URL(req.url).searchParams.get("region") ?? undefined;
  const drivers = await getLatestEconomicDrivers(region);
  return privateJson({ drivers });
}
