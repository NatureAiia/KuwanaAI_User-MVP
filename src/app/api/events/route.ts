import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
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
  ]),
  sector: z
    .enum(["telecom", "banking", "insurance", "education", "healthcare", "transport", "utilities", "pharmacy"])
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const gamification = await prisma.$transaction(
    (tx) => recordEvent(tx, { userId: user.id, ...parsed.data }),
    { timeout: 15_000 },
  );

  return NextResponse.json({ gamification });
}
