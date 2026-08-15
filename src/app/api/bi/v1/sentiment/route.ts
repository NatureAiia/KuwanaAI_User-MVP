import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireApiKey, requireScope } from "@/lib/bi/auth";
import { ensureSentimentComputed, getSentimentSummary } from "@/lib/sentiment";

export async function GET(req: Request) {
  const auth = await requireApiKey(req);
  if ("response" in auth) return auth.response;
  const { apiKey } = auth;
  const scopeError = requireScope(apiKey, "read:sentiment");
  if (scopeError) return scopeError;

  // A provider-scoped key only ever sees its own provider's mentions — the
  // query param below is for a platform-wide key wanting one provider's
  // slice, and is ignored for a provider-scoped key so it can't read another
  // provider's sentiment by passing a different name.
  let matchedProvider: string | undefined;
  if (apiKey.providerId) {
    const provider = await prisma.provider.findUnique({ where: { id: apiKey.providerId }, select: { name: true } });
    matchedProvider = provider?.name;
  } else {
    matchedProvider = new URL(req.url).searchParams.get("provider") ?? undefined;
  }

  const where: Prisma.SocialPriceMentionWhereInput = matchedProvider ? { matchedProvider } : {};
  await ensureSentimentComputed(where);
  const summary = await getSentimentSummary(where);
  return privateJson({ provider: matchedProvider ?? null, ...summary });
}
