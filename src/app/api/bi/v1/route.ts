import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireApiKey } from "@/lib/bi/auth";

/** "Whoami" — lets a BI tool confirm its key, scopes, and provider link without hitting a data endpoint. */
export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if ("response" in auth) return auth.response;
  const { apiKey } = auth;

  const provider = apiKey.providerId
    ? await prisma.provider.findUnique({ where: { id: apiKey.providerId }, select: { name: true } })
    : null;

  return privateJson({
    scopes: apiKey.scopes,
    provider: provider ? { name: provider.name } : null,
    endpoints: [
      "/api/bi/v1/market-overview",
      "/api/bi/v1/pricing-intelligence",
      "/api/bi/v1/economic-drivers",
      "/api/bi/v1/business-conditions",
      "/api/bi/v1/sentiment",
      "/api/bi/v1/my-account",
    ],
  });
}
