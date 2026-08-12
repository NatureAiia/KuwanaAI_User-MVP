import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyIntake } from "@/lib/ai/intakeClassifier";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, clientKey } from "@/lib/rateLimit";

// Deliberately no auth check — /explore itself is intentionally public for
// pre-signup browsing (see proxy.ts), and this is just a faster way into
// the same read-only pages, not a consumer-identity action.
const bodySchema = z.object({ query: z.string().trim().min(1).max(300) });

// Every call here hits the paid Anthropic API unauthenticated — the tighter,
// cost-relevant limit of the two public endpoints. Still generous for a real
// visitor trying a few different needs while browsing.
//
// That combination — unauthenticated, and a billed model call per request —
// makes this the cheapest way to run up the project's Anthropic bill from a
// laptop. See lib/rateLimit.ts for why a per-instance counter is a real but
// partial mitigation on a serverless deploy.
const RATE_LIMIT = { limit: 20, windowSeconds: 10 * 60 };
// Every call here hits the self-hosted Llama endpoint unauthenticated — the
// tighter, cost-relevant limit of the two public endpoints. Still generous
// for a real visitor trying a few different needs while browsing.
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 20 };

export async function POST(req: Request) {
  const limited = await enforceRateLimit(`need-intake:${clientKey(req)}`, RATE_LIMIT);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await classifyIntake(parsed.data.query);
  return privateJson(result);
}
