import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumerOrCorporate } from "@/lib/auth";
import { privateJson } from "@/lib/apiResponse";
import { emailDomain } from "@/lib/orgVerification";
import { streamAiText } from "@/lib/ai/provider";
import { computeDecisionScores } from "@/lib/scoring";
import { getListingPriceTrends } from "@/lib/catalog";
import { getConsumerChatContext, getCorporateChatContext } from "@/lib/chatContext";
import { recordEvent } from "@/lib/gamification/process-event";
import { STREAM_META_MARKER, STREAM_ERROR_MARKER, STREAM_STATUS_MARKER } from "@/lib/chatStream";
import {
  enforceRateLimit,
  acquireConcurrencySlot,
  RATE_LIMITS,
  CONCURRENCY_LIMITS,
} from "@/lib/rateLimit";
import type { NormalizedMessage } from "@/lib/ai/types";

const CHAT_HISTORY_LIMIT = 20;

/**
 * Wall-clock ceiling on a single generation. Well past a normal 700-token
 * reply, but bounded — without it an upstream that accepts the connection and
 * then stalls holds a slot, a DB-free request, and a billing meter open until
 * the platform's own (much longer) timeout fires.
 */
const CHAT_STREAM_TIMEOUT_MS = 120_000;

const CONSUMER_SYSTEM_PROMPT =
  "You are the Kuwana Assistant — a friendly, concise AI chat assistant for Kuwana, an AI-assisted, " +
  "explainable comparison platform for telecom, banking, insurance, and education in Zimbabwe. Kuwana is " +
  "a PG / general-audience app, so explain things the way you would to a bright 10-year-old: plain " +
  "everyday words, no jargon or acronyms without explaining them, short sentences, and a concrete " +
  "everyday comparison when a concept is abstract (e.g. explain a decision score the way you'd explain " +
  "why one snack is a better deal than another). Help users understand their options, how to compare " +
  "providers, and how Kuwana's decision score works (a transparent price/benefit blend). Never invent " +
  "specific prices, providers, or statistics — if the user asks about specific current listings and none " +
  "are provided below as grounding data, say so plainly and point them to the Explore tab for live " +
  "comparisons rather than guessing. You may also be given the user's own account snapshot (saved " +
  "listings, past comparisons, wallet balance, unread notifications) below — use it to make the reply " +
  "feel personal: greet returning context by name where it fits ('you were comparing the NetOne and " +
  "Econet bundles last week — want a quick recap, or should I check what's changed?') rather than " +
  "speaking generically, but never invent a figure, name, or date not present in it. If an image is " +
  "attached, you may describe or reason about it, but still never invent specific prices for a product " +
  "you recognize unless that price is present in the grounding data. Be genuinely helpful and " +
  "opinionated: when the grounding data supports it, tell the user plainly what you'd pick and why, " +
  "rather than just listing facts back at them neutrally. Frame that guidance as everyday tips grounded " +
  "in the data you were given ('here's a tip, based on what's in front of me: ...'), not as formal " +
  "financial, legal, or medical advice — and never present a number or claim that isn't actually present " +
  "in the grounding data as if it were.\n\n" +
  "Format every reply in Markdown. For a substantive answer (a comparison, an explanation, anything " +
  "with more than one part) structure it as: a short bolded heading line, an optional italic one-line " +
  "subtitle giving context, then the answer itself (short paragraphs, bullet points, or **bold** for the " +
  "key figures/names), and finish with a one-line `**Simple answer:**` that restates the takeaway in the " +
  "plainest possible terms — the way you'd sum it up for someone who only read that one line. Skip the " +
  "heading/subtitle scaffolding for a quick, one-part reply (a greeting, a yes/no, a single fact) and " +
  "just answer plainly — still in Markdown, still ending with a `**Simple answer:**` line if the reply is " +
  "more than a sentence. Never write a disclaimer about being an AI or not being a financial advisor " +
  "yourself — the app shows that separately after every reply.";

const CORPORATE_SYSTEM_PROMPT =
  "You are the Kuwana Business Assistant — a concise AI assistant for corporate accounts on Kuwana's " +
  "'Kuwana for Business' portal. Help the user understand their own catalog's pricing position, " +
  "triggered alert rules, and open investigations, using only the account snapshot provided below as " +
  "grounding — never invent listing names, prices, or counts not present in it. If the account isn't yet " +
  "linked to a provider catalog, say so plainly rather than guessing. Keep replies short (2-4 sentences " +
  "unless more detail is clearly needed).\n\n" +
  "Format every reply in Markdown. For a substantive answer, structure it as a short bolded heading " +
  "line, the answer itself (short paragraphs, bullet points, or **bold** for key figures), and a closing " +
  "`**Simple answer:**` line restating the takeaway in one plain sentence; skip that scaffolding for a " +
  "quick one-part reply. Never write a disclaimer about being an AI or not being a financial/legal " +
  "advisor yourself — the app shows that separately after every reply.";

const IMAGE_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const postSchema = z.object({
  content: z.string().trim().max(2000),
  listingIds: z.array(z.string()).max(6).optional(),
  budgetFlexibility: z.enum(["low", "medium", "high"]).optional(),
  constraints: z.array(z.string().trim().min(1).max(80)).max(3).optional(),
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

  return privateJson({
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

  // Before the body is even parsed: everything below this line either queries
  // the database or bills a model, and neither should happen for a caller
  // already over budget. Keyed by user id rather than IP — this route is
  // authenticated, so identity is known and not spoofable by header.
  const limited = await enforceRateLimit(`chat:${user.id}`, RATE_LIMITS.authedAi);
  if (limited) return limited;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { content, listingIds, budgetFlexibility, constraints, image, conversationId } = parsed.data;
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

  if (budgetFlexibility || (constraints && constraints.length > 0)) {
    const parts: string[] = [];
    if (budgetFlexibility) {
      parts.push(
        `Budget flexibility: ${budgetFlexibility}${budgetFlexibility === "low" ? " (price is the deciding factor — cheapest acceptable option)" : budgetFlexibility === "medium" ? " (value-conscious, some room)" : " (price is not the deciding factor)"}`,
      );
    }
    if (constraints?.length) parts.push(`Stated constraints: ${constraints.join("; ")}`);
    system += `\n\nUser context carried over from their comparison — use to tailor your reasoning, never claim a constraint is met unless the grounding data supports it:\n${parts.join("\n")}`;
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

  // A cap on simultaneous streams, separate from the per-minute limit above:
  // each open stream holds an upstream generation, so N at once costs N times
  // as much regardless of how few requests-per-minute that represents.
  const slot = await acquireConcurrencySlot(`chat:${user.id}`, CONCURRENCY_LIMITS.chatStreams);
  if (!slot.acquired) {
    return NextResponse.json(
      { error: "You already have several chats generating. Wait for one to finish and try again." },
      { status: 429, headers: { "Retry-After": "10" } },
    );
  }

  /**
   * Writes the turn and returns the client's `meta` payload.
   *
   * Split out of the stream body because it is now reached from two places: a
   * generation that ran to completion, and one cut short by a disconnect or
   * the timeout. A partial reply is still a real reply — the user watched it
   * appear — so dropping it would lose visible history.
   */
  const persistTurn = async (fullText: string) => {
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
    return {
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
  };

  // Aborted by three things: the client disconnecting (cancel below), the
  // wall-clock timeout, and nothing else. Threaded into streamAiText so the
  // abort reaches the provider's socket — cancelling only on our side would
  // stop us reading the tokens, not stop the model producing and charging for
  // them.
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), CHAT_STREAM_TIMEOUT_MS);

  // Both causes abort the same signal, but they differ in one way that
  // matters: on a timeout the client is still there and should be told, while
  // on a disconnect there is nobody left to tell. Gating the writes on
  // `signal.aborted` alone would silently drop the error marker in the first
  // case, leaving the user with a reply that just stops.
  let clientGone = false;

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      // Every write goes through here so a disconnect unwinds quietly instead
      // of raising an unhandled rejection inside the stream.
      const send = (chunk: string) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* consumer gone */
        }
      };

      const close = () => {
        if (clientGone) return;
        try {
          controller.close();
        } catch {
          /* already closed by the consumer */
        }
      };

      try {
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
            signal: abort.signal,
          })) {
            // Status events (e.g. tier escalation) are forwarded to the client
            // but must never be persisted as part of the assistant's reply.
            if (delta.startsWith(STREAM_STATUS_MARKER)) {
              send(delta);
              continue;
            }
            fullText += delta;
            send(delta);
          }
        } catch (err) {
          // An abort is expected control flow, not a failure: keep whatever
          // was generated and fall through to persistence below.
          if (!abort.signal.aborted) {
            // Previously swallowed silently — log so production failures are diagnosable.
            console.error("[chat] AI stream failed:", err);
            send(STREAM_ERROR_MARKER);
            close();
            return;
          }
        }

        if (!fullText.trim()) {
          send(STREAM_ERROR_MARKER);
          controller.close();
          return;
        }

        try {
          send(STREAM_META_MARKER + JSON.stringify(await persistTurn(fullText)));
        } catch (err) {
          console.error("[chat] persisting the turn failed:", err);
          send(STREAM_ERROR_MARKER);
        }
        close();
      } finally {
        clearTimeout(timeout);
        await slot.release();
      }
    },

    /**
     * Fired when the client goes away — closed tab, navigation, lost network.
     * Aborting here is the whole point of the fix: without it the generation
     * continued to completion and was billed in full, then discarded.
     *
     * `start` keeps running after this: it unwinds out of the for-await and
     * still persists whatever was generated, so the partial reply survives in
     * the user's history even though nothing can be written back to them.
     */
    cancel() {
      clientGone = true;
      abort.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
