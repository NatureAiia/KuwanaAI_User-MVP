import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { boundedJsonRecord } from "@/lib/zodShared";
import { recordEvent } from "@/lib/gamification/process-event";

const bodySchema = z.object({
  eventType: z.enum([
    "profile_completed",
    "comparison_viewed",
    "comparison_completed",
    "recommendation_viewed",
    "item_saved",
    "action_taken",
    "daily_visit",
    "advert_opened",
  ]),
  sector: z
    .enum([
      "telecom",
      "banking",
      "insurance",
      "education",
      "healthcare",
      "transport",
      "utilities",
      "pharmacy",
      "electronics",
      "fashion",
      "hotels",
      "retail",
    ])
    .optional(),
  // Unbounded, this was a free write-amplification primitive into a Json
  // column, same class of issue boundedJsonRecord was added for elsewhere.
  metadata: boundedJsonRecord(40, 8_000).optional(),
});

export async function POST(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const limited = await enforceRateLimit(`events:${user.id}`, RATE_LIMITS.authedWrite);
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const gamification = await prisma.$transaction(
    (tx) => recordEvent(tx, { userId: user.id, ...parsed.data }),
    { timeout: 15_000 },
  );

  return privateJson({ gamification });
}
