import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { privateJson } from "@/lib/apiResponse";
import type { QuestCriteria } from "@/lib/gamification/rules";

const ADVERT_QUEST_TARGET = 3;
const ADVERT_QUEST_WINDOW_DAYS = 5;

const bodySchema = z.object({
  sponsorName: z.string().trim().min(1).max(80),
  tagline: z.string().trim().min(1).max(120),
  imageUrl: z.string().url(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const adverts = await prisma.advert.findMany({ orderBy: { createdAt: "desc" } });
  return privateJson({ adverts });
}

/**
 * Ensures a call-to-action quest is running whenever a fresh advert lands —
 * "open 3 adverts in 5 days". The quest engine (recordEvent) already supports
 * several quests being active at once, so this doesn't collide with whatever
 * scripts/quest-rotation currently has active; it only avoids stacking a
 * second advert-quest on top of one that's still running.
 */
async function ensureAdvertQuest(now: Date): Promise<void> {
  const activeQuests = await prisma.quest.findMany({
    where: { activeFrom: { lte: now }, activeTo: { gte: now } },
  });
  const hasAdvertQuest = activeQuests.some((q) => (q.criteria as QuestCriteria).type === "advert_open_count");
  if (hasAdvertQuest) return;

  await prisma.quest.create({
    data: {
      name: "Advert explorer",
      description: `Open ${ADVERT_QUEST_TARGET} adverts in ${ADVERT_QUEST_WINDOW_DAYS} days.`,
      criteria: { type: "advert_open_count", target: ADVERT_QUEST_TARGET } satisfies QuestCriteria,
      activeFrom: now,
      activeTo: new Date(now.getTime() + ADVERT_QUEST_WINDOW_DAYS * 86_400_000),
    },
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const advert = await prisma.advert.create({ data: parsed.data });
  await ensureAdvertQuest(new Date());

  await logAdminAction({
    adminEmail: admin.email,
    action: "advert_created",
    targetType: "advert",
    targetId: advert.id,
    detail: `${advert.sponsorName}: "${advert.tagline}"`,
  });

  return privateJson({ advert });
}
