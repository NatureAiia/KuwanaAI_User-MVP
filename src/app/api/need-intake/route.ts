import { NextResponse } from "next/server";
import { z } from "zod";
import { classifyIntake } from "@/lib/ai/intakeClassifier";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Deliberately no auth check — /explore itself is intentionally public for
// pre-signup browsing (see proxy.ts), and this is just a faster way into
// the same read-only pages, not a consumer-identity action.
const bodySchema = z.object({ query: z.string().trim().min(1).max(300) });

// Every call here hits the paid Anthropic API unauthenticated — the tighter,
// cost-relevant limit of the two public endpoints. Still generous for a real
// visitor trying a few different needs while browsing.
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 20 };

export async function POST(req: Request) {
  const allowed = await checkRateLimit(`need-intake:${getClientIp(req)}`, RATE_LIMIT);
  if (!allowed) return NextResponse.json({ error: "Too many requests — try again later." }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await classifyIntake({ text: parsed.data.query });
  return NextResponse.json(result);
}
