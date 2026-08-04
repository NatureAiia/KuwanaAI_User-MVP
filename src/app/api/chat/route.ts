import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { anthropic, RECOMMENDATION_MODEL } from "@/lib/ai/anthropic";
import { computeDecisionScores } from "@/lib/scoring";
import { getListingPriceTrends } from "@/lib/catalog";
import { recordEvent } from "@/lib/gamification/process-event";
import { STREAM_META_MARKER, STREAM_ERROR_MARKER } from "@/lib/chatStream";

const CHAT_HISTORY_LIMIT = 20;

const SYSTEM_PROMPT =
  "You are the Kuwana Assistant — a friendly, concise AI chat assistant for Kuwana, an AI-assisted, " +
  "explainable comparison platform for telecom, banking, insurance, and education in Zimbabwe. Help " +
  "users understand their options, how to compare providers, and how Kuwana's decision score works " +
  "(a transparent price/benefit blend). Never invent specific prices, providers, or statistics — if the " +
  "user asks about specific current listings and none are provided below as grounding data, say so " +
  "plainly and point them to the Explore tab for live comparisons rather than guessing. If an image is " +
  "attached, you may describe or reason about it, but still never invent specific prices for a product " +
  "you recognize unless that price is present in the grounding data. Keep replies short (2-4 sentences " +
  "unless more detail is clearly needed). Always make clear you're an AI assistant, not a financial advisor.";

const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const postSchema = z.object({
  content: z.string().trim().max(2000),
  listingIds: z.array(z.string()).max(6).optional(),
  image: z
    .object({
      mediaType: z.enum(IMAGE_MEDIA_TYPES),
      data: z.string().max(6_000_000), // ~4.5MB decoded, comfortably under Claude's per-image limit
    })
    .optional(),
});

async function listingSummaries(listingIds: string[]) {
  if (listingIds.length === 0) return [];
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds } },
    include: { provider: true, category: { include: { sector: true } } },
  });
  return listings.map((l) => ({
    id: l.id,
    name: l.name,
    price: Number(l.price),
    currency: l.currency,
    provider: l.provider.name,
    categoryId: l.categoryId,
    sectorSlug: l.category.sector.slug,
  }));
}

export async function GET() {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const conversation = await prisma.conversation.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  const distinctListingIds = [...new Set(conversation?.messages.flatMap((m) => m.listingIds) ?? [])];
  const summaries = await listingSummaries(distinctListingIds);
  const summaryById = new Map(summaries.map((s) => [s.id, s]));

  return NextResponse.json({
    conversationId: conversation?.id ?? null,
    messages:
      conversation?.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        listings: m.listingIds.map((id) => summaryById.get(id)).filter((s) => !!s),
      })) ?? [],
  });
}

export async function POST(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { content, listingIds, image } = parsed.data;
  if (!content && !image) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }

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

  const lastUserContent: Parameters<typeof anthropic.messages.stream>[0]["messages"][number]["content"] = image
    ? [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        { type: "text", text: content || "What can you tell me about this?" },
      ]
    : content;

  const claudeMessages = [
    ...priorMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: lastUserContent },
  ];

  const persistedUserContent = content || "[Image attached]";

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      try {
        const stream = anthropic.messages.stream({
          model: RECOMMENDATION_MODEL,
          max_tokens: 700,
          system,
          messages: claudeMessages,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch {
        controller.enqueue(encoder.encode(STREAM_ERROR_MARKER));
        controller.close();
        return;
      }

      if (!fullText.trim()) {
        controller.enqueue(encoder.encode(STREAM_ERROR_MARKER));
        controller.close();
        return;
      }

      try {
        const { assistantMessage, conversationId, gamification } = await prisma.$transaction(
          async (tx) => {
            const conv = conversation ?? (await tx.conversation.create({ data: { userId: user.id } }));

            await tx.message.create({
              data: { conversationId: conv.id, role: "user", content: persistedUserContent, listingIds: listingIds ?? [] },
            });
            const assistant = await tx.message.create({
              data: { conversationId: conv.id, role: "assistant", content: fullText, listingIds: listingIds ?? [] },
            });
            await tx.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });

            const gam = isNewConversation
              ? await recordEvent(tx, { userId: user.id, eventType: "chat_started" })
              : null;

            return { assistantMessage: assistant, conversationId: conv.id, gamification: gam };
          },
          { timeout: 15_000 },
        );

        const listings = await listingSummaries(listingIds ?? []);
        const meta = {
          conversationId,
          gamification,
          message: {
            id: assistantMessage.id,
            role: "assistant" as const,
            content: fullText,
            createdAt: assistantMessage.createdAt.toISOString(),
            listings,
          },
        };
        controller.enqueue(encoder.encode(STREAM_META_MARKER + JSON.stringify(meta)));
      } catch {
        controller.enqueue(encoder.encode(STREAM_ERROR_MARKER));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
