import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { recordEvent } from "@/lib/gamification/process-event";
import { privateJson } from "@/lib/apiResponse";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { sectorEnum, boundedJsonRecord } from "@/lib/zodShared";
import { CLIENT_REPORTABLE_EVENTS, EVENT_COOLDOWN_SECONDS } from "@/lib/gamification/clientEvents";

const bodySchema = z.object({
  eventType: z.enum(CLIENT_REPORTABLE_EVENTS),
  sector: sectorEnum.optional(),
  metadata: boundedJsonRecord(20, 2_000).optional(),
  eventType: z.enum([
    "profile_completed",
    "comparison_viewed",
    "comparison_completed",
    "recommendation_viewed",
    "item_saved",
    "action_taken",
    "daily_visit",
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
  metadata: z.record(z.string(), z.unknown()).optional(),
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
  const { eventType } = parsed.data;

  // XP is a leaderboard-ranked currency, and this is the one route where a
  // client asserts an event happened rather than the server observing it. A
  // per-event-type cooldown means replaying the same POST in a loop stops
  // paying out, without blocking a user who genuinely views several
  // comparisons in a session.
  //
  // Scoped by sector when one is given: `comparison_viewed` fires per sector
  // and feeds the distinct-sector badge, so a flat per-type cooldown would
  // make browsing three sectors in a row silently drop two of them.
  const cooldownSeconds = EVENT_COOLDOWN_SECONDS[eventType];
  const recent = await prisma.userEvent.findFirst({
    where: {
      userId: user.id,
      eventType,
      ...(parsed.data.sector ? { sector: parsed.data.sector } : {}),
      createdAt: { gte: new Date(Date.now() - cooldownSeconds * 1000) },
    },
    select: { id: true },
  });
  if (recent) {
    return privateJson({ gamification: null, throttled: true });
  }

  const gamification = await prisma.$transaction(
    (tx) => recordEvent(tx, { userId: user.id, ...parsed.data }),
    { timeout: 15_000 },
  );

  return privateJson({ gamification });
}
