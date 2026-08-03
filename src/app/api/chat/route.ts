import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { anthropic, RECOMMENDATION_MODEL } from "@/lib/ai/anthropic";
import { computeDecisionScores } from "@/lib/scoring";
import { getListingPriceTrends } from "@/lib/catalog";
import { recordEvent } from "@/lib/gamification/process-event";

const CHAT_HISTORY_LIMIT = 20;

const SYSTEM_PROMPT =
  "You are the Kuwana Assistant — a friendly, concise AI chat assistant for Kuwana, an AI-assisted, " +
  "explainable comparison platform for telecom, banking, insurance, and education in Zimbabwe. Help " +
  "users understand their options, how to compare providers, and how Kuwana's decision score works " +
  "(a transparent price/benefit blend). Never invent specific prices, providers, or statistics — if the " +
  "user asks about specific current listings and none are provided below as grounding data, say so " +
  "plainly and point them to the Explore tab for live comparisons rather than guessing. Keep replies " +
  "short (2-4 sentences unless more detail is clearly needed). Always make clear you're an AI assistant, " +
  "not a financial advisor.";

const postSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  listingIds: z.array(z.string()).max(6).optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const conversation = await prisma.conversation.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({
    conversationId: conversation?.id ?? null,
    messages:
      conversation?.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })) ?? [],
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { content, listingIds } = parsed.data;

  const conversation = await prisma.conversation.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: CHAT_HISTORY_LIMIT } },
  });
  const isNewConversation = !conversation;
  const priorMessages = conversation ? [...conversation.messages].reverse() : [];

  let system = SYSTEM_PROMPT;
  if (listingIds && listingIds.length > 0) {
    const listings = await prisma.listing.findMany({
      where: { id: { in: listingIds } },
      include: { provider: true, category: { include: { attributeSchema: true } } },
    });
    if (listings.length > 0) {
      const trends = await getListingPriceTrends(listingIds);
      const sameCategory = listings.every((l) => l.categoryId === listings[0].categoryId);
      const scores = sameCategory
        ? computeDecisionScores(
            listings.map((l) => ({
              id: l.id,
              name: l.name,
              price: Number(l.price),
              currency: l.currency,
              attributes: l.attributes as Record<string, unknown>,
              freshnessStatus: l.freshnessStatus,
              lastVerifiedAt: l.lastVerifiedAt.toISOString(),
              sourceUrl: l.sourceUrl,
              provider: l.provider,
            })),
            listings[0].category.attributeSchema.map((a) => ({
              key: a.key,
              label: a.label,
              dataType: a.dataType,
              unit: a.unit,
              isComparable: a.isComparable,
              sortOrder: a.sortOrder,
            })),
            trends,
          )
        : {};

      const grounding = listings.map((l) => ({
        name: l.name,
        provider: l.provider.name,
        provider_verified: l.provider.verified,
        price: Number(l.price),
        currency: l.currency,
        freshness: l.freshnessStatus,
        decision_score: scores[l.id]?.total ?? null,
        price_trend: trends[l.id]
          ? { direction: trends[l.id]!.direction, change_percent: trends[l.id]!.changePercent }
          : null,
      }));
      system += `\n\nGrounding data for the listing(s) the user is asking about — only reference numbers from here, never invent any:\n${JSON.stringify(grounding, null, 2)}`;
    }
  }

  const claudeMessages = [
    ...priorMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content },
  ];

  const response = await anthropic.messages.create({
    model: RECOMMENDATION_MODEL,
    max_tokens: 700,
    system,
    messages: claudeMessages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return NextResponse.json({ error: "No reply generated" }, { status: 502 });
  }
  const replyText = textBlock.text;

  const { assistantMessage, conversationId, gamification } = await prisma.$transaction(async (tx) => {
    const conv =
      conversation ?? (await tx.conversation.create({ data: { userId: user.id } }));

    await tx.message.create({
      data: { conversationId: conv.id, role: "user", content, listingIds: listingIds ?? [] },
    });
    const assistant = await tx.message.create({
      data: { conversationId: conv.id, role: "assistant", content: replyText, listingIds: listingIds ?? [] },
    });
    await tx.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });

    const gam = isNewConversation
      ? await recordEvent(tx, { userId: user.id, eventType: "chat_started" })
      : null;

    return { assistantMessage: assistant, conversationId: conv.id, gamification: gam };
  });

  return NextResponse.json({
    conversationId,
    message: {
      id: assistantMessage.id,
      role: "assistant",
      content: assistantMessage.content,
      createdAt: assistantMessage.createdAt.toISOString(),
    },
    gamification,
  });
}
