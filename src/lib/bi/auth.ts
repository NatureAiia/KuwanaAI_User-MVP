import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { hashApiKey } from "@/lib/bi/keys";
import type { BiScope } from "@/lib/bi/scopes";
import type { ApiKey } from "@prisma/client";

type AuthedApiKey = Pick<ApiKey, "id" | "scopes" | "providerId">;

/**
 * Validates the Bearer token on a /api/bi/v1/* request: looks up the key by
 * its hash, rejects a revoked one, rate-limits by key id (not IP — a shared
 * BI tool behind one office IP shouldn't share a budget with every other
 * key), and records lastUsedAt. No separate usage-log table (see the
 * ApiKey model's own comment) — lastUsedAt is enough at this app's scale.
 */
export async function requireApiKey(
  req: Request,
): Promise<{ apiKey: AuthedApiKey } | { response: NextResponse }> {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  if (!match) {
    return { response: privateJson({ error: "Missing or malformed Authorization: Bearer <key> header" }, { status: 401 }) };
  }

  const apiKey = await prisma.apiKey.findUnique({ where: { hashedKey: hashApiKey(match[1]) } });
  if (!apiKey || apiKey.revokedAt) {
    return { response: privateJson({ error: "Invalid or revoked API key" }, { status: 401 }) };
  }

  const limited = await enforceRateLimit(`bi:${apiKey.id}`, RATE_LIMITS.biApi);
  if (limited) return { response: limited };

  // Fire-and-forget: a slow/failed write here must never delay or fail the
  // actual data response.
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { apiKey };
}

/** 403s when the key wasn't granted `scope` — checked per-endpoint after requireApiKey(). */
export function requireScope(apiKey: AuthedApiKey, scope: BiScope): NextResponse | null {
  if (apiKey.scopes.includes(scope)) return null;
  return privateJson({ error: `This key is missing the "${scope}" scope` }, { status: 403 });
}
