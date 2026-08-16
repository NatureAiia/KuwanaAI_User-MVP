import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumerOrCorporate } from "@/lib/auth";
import { emailDomain } from "@/lib/orgVerification";
import { streamAiText } from "@/lib/ai/provider";
import { computeDecisionScores } from "@/lib/scoring";
import { getListingPriceTrends } from "@/lib/catalog";
import { getConsumerChatContext, getCorporateChatContext } from "@/lib/chatContext";
import { recordEvent } from "@/lib/gamification/process-event";
import { STREAM_META_MARKER, STREAM_ERROR_MARKER, STREAM_STATUS_MARKER } from "@/lib/chatStream";
import type { NormalizedMessage } from "@/lib/ai/types";

const CHAT_HISTORY_LIMIT = 20;

const CONSUMER_SYSTEM_PROMPT =
  "You are the Kuwana Assistant — a friendly, concise AI chat assistant for Kuwana, an AI-assisted, " +
  "explainable comparison platform for telecom, banking, insurance, and education in Zimbabwe. Help " +
  "users understand their options, how to compare providers, and how Kuwana's decision score works " +
  "(a transparent price/benefit blend). Never invent specific prices, providers, or statistics — if the " +
  "user asks about specific current listings and none are provided below as grounding data, say so " +
  "plainly and point them to the Explore tab for live comparisons rather than guessing. You may also be " +
  "given the user's own account snapshot (saved listings, wallet balance, unread notifications) below — " +
  "you may answer questions about their own account from that data, but never invent figures not present " +
  "in it. If an image is attached, you may describe or reason about it, but still never invent specific " +
  "prices for a product you recognize unless that price is present in the grounding data. Keep replies " +
  "short (2-4 sentences unless more detail is clearly needed). Always make clear you're an AI assistant, " +
  "not a financial advisor.";

const CORPORATE_SYSTEM_PROMPT =
  "You are the Kuwana Business Assistant — a concise AI assistant for corporate accounts on Kuwana's " +
  "'Kuwana for Business' portal. Help the user understand their own catalog's pricing position, " +
  "triggered alert rules, and open investigations, using only the account snapshot provided below as " +
  "grounding — never invent listing names, prices, or counts not present in it. If the account isn't yet " +
  "linked to a provider catalog, say so plainly rather than guessing. Keep replies short (2-4 sentences " +
  "unless more detail is clearly needed). Always make clear you're an AI assistant, not a financial or " +
  "legal advisor.";

const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const postSchema = z.object({
  content: z.string().trim().max(2000),
  listingIds: z.array(z.string()).max(6).optional(),
  conversationId: z.string().uuid().optional(),
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
    where: { id: { in: listingIds }, status: "published" },
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

/** A corporate caller's own provider, resolved the same email-domain-match way every corporate route does. */
async function resolveCorporateProvider(email: string | undefined) {
  const domain = email ? emailDomain(email) : null;
  return domain ? prisma.provider.findFirst({ where: { corporateDomain: domain } }) : null;
}

export async function GET(req: Request) {
  const auth = await requireConsumerOrCorporate();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const requestedId = new URL(req.url).searchParams.get("conversationId");

  const conversation = await prisma.conversation.findFirst({
    // A requested id must belong to this user — an unowned/unknown id falls
    // through to "most recent", the same as no id being passed at all.
    where: requestedId ? { id: requestedId, userId: user.id } : { userId: user.id },
    orderBy: { lastMessageAt: "desc" },
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
  const auth = await requireConsumerOrCorporate();
  if ("response" in auth) return auth.response;
  const { user, role } = auth;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { content, listingIds, image, conversationId } = parsed.data;
  if (!content && !image) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }

  // An explicit conversationId must belong to this user — otherwise this is
  // a "New chat": always create a fresh conversation rather than silently
  // resuming whatever the user's most recent thread happened to be.
  const conversation = conversationId
    ? await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
        include: { messages: { orderBy: { createdAt: "desc" }, take: CHAT_HISTORY_LIMIT } },
      })
    : null;
  if (conversationId && !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  const isNewConversation = !conversation;
  const priorMessages = conversation ? [...conversation.messages].reverse() : [];

  let system = role === "corporate" ? CORPORATE_SYSTEM_PROMPT : CONSUMER_SYSTEM_PROMPT;

  if (role === "corporate") {
    const provider = await resolveCorporateProvider(user.email);
    const context = provider ? await getCorporateChatContext(provider.id) : null;
    system += context
      ? `\n\nYour account snapshot (${provider!.name}) — only reference figures from here, never invent any:\n${JSON.stringify(context, null, 2)}`
      : "\n\nThis account isn't linked to a provider catalog yet — tell the user to ask an admin to link it before you can answer catalog-specific questions.";
  } else {
    const context = await getConsumerChatContext(user.id);
    system += `\n\nYour account snapshot — only reference figures from here, never invent any:\n${JSON.stringify(context, null, 2)}`;
  }

  if (listingIds && listingIds.length > 0) {
    const listings = await prisma.listing.findMany({
      where: { id: { in: listingIds }, status: "published" },
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
              images: l.images,
              description: l.description ?? null,
              rating: l.rating === null || l.rating === undefined ? null : Number(l.rating),
              reviewCount: l.reviewCount ?? 0,
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

  // Provider-neutral shape; lib/ai/provider.ts translates it for whichever
  // model is currently selected, and drops the image for a text-only model.
  const lastUserContent: NormalizedMessage["content"] = image
    ? {
        text: content || "What can you tell me about this?",
        image: { mediaType: image.mediaType, data: image.data },
      }
    : content;

  const modelMessages: NormalizedMessage[] = [
    ...priorMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: lastUserContent },
  ];

  const persistedUserContent = content || "[Image attached]";

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      try {
        for await (const delta of streamAiText({
          feature: "chat",
          signals: {
            feature: "chat",
            hasImage: Boolean(image),
            turnCount: priorMessages.length,
            messageLength: content.length,
            // `listingIds` is what the user asked about; grounding data for
            // several listings is the case that needs real reasoning rather
            // than a definition.
            groundedListings: listingIds?.length ?? 0,
          },
          userId: user.id,
          system,
          messages: modelMessages,
          maxTokens: 700,
        })) {
          // Status events (e.g. tier escalation) are forwarded to the client
          // but must never be persisted as part of the assistant's reply.
          if (delta.startsWith(STREAM_STATUS_MARKER)) {
            controller.enqueue(encoder.encode(delta));
            continue;
          }
          fullText += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        // Previously swallowed silently — log so production failures are diagnosable.
        console.error("[chat] AI stream failed:", err);
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
        const { assistantMessage, conversationId: convId, gamification } = await prisma.$transaction(
          async (tx) => {
            const conv = conversation ?? (await tx.conversation.create({ data: { userId: user.id } }));

            await tx.message.create({
              data: { conversationId: conv.id, role: "user", content: persistedUserContent, listingIds: listingIds ?? [] },
            });
            const assistant = await tx.message.create({
              data: { conversationId: conv.id, role: "assistant", content: fullText, listingIds: listingIds ?? [] },
            });
            await tx.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } });

            // Gamification is a consumer-only concept (see CorporateHeader's
            // own note on this) — a corporate account's first message never
            // awards it.
            const gam =
              isNewConversation && role === "consumer"
                ? await recordEvent(tx, { userId: user.id, eventType: "chat_started" })
                : null;

            return { assistantMessage: assistant, conversationId: conv.id, gamification: gam };
          },
          { timeout: 15_000 },
        );

        const listings = await listingSummaries(listingIds ?? []);
        const meta = {
          conversationId: convId,
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
