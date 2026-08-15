import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireApiKey, requireScope } from "@/lib/bi/auth";
import { getProviderFeeComparison } from "@/lib/pricingIntelligence";
import { getCompetitorWatch } from "@/lib/catalog";
import { ensureSentimentComputed, getSentimentSummary } from "@/lib/sentiment";

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if ("response" in auth) return auth.response;
  const { apiKey } = auth;
  const scopeError = requireScope(apiKey, "read:account");
  if (scopeError) return scopeError;

  if (!apiKey.providerId) {
    return privateJson({ error: "This is a platform-wide key — read:account requires a provider-linked key" }, { status: 403 });
  }

  const provider = await prisma.provider.findUnique({ where: { id: apiKey.providerId }, select: { name: true } });
  const where = provider ? { matchedProvider: provider.name } : {};
  await ensureSentimentComputed(where);

  const [feeComparison, competitorWatch, sentiment] = await Promise.all([
    getProviderFeeComparison(apiKey.providerId),
    getCompetitorWatch(apiKey.providerId),
    getSentimentSummary(where),
  ]);

  return privateJson({
    provider: provider?.name ?? null,
    feeComparison,
    competitorWatch,
    sentiment,
  });
}
