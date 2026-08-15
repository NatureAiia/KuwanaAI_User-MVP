import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireConsumerOrCorporate } from "@/lib/auth";

const PREVIEW_LENGTH = 48;

/**
 * Lists this user's own conversations, newest-active first, for the chat
 * thread switcher. No separate "create thread" endpoint — a "New chat"
 * click just clears the client's active conversationId, and the next
 * message sent (with no conversationId) creates one, same as it always has.
 */
export async function GET() {
  const auth = await requireConsumerOrCorporate();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const conversations = await prisma.conversation.findMany({
    where: { userId: user.id },
    orderBy: { lastMessageAt: "desc" },
    take: 30,
    include: { messages: { orderBy: { createdAt: "asc" }, take: 1, select: { content: true } } },
  });

  return NextResponse.json({
    threads: conversations
      // A conversation with no messages yet shouldn't exist (created inside
      // the same transaction as its first message), but skip it defensively
      // rather than showing an empty thread pill.
      .filter((c) => c.messages.length > 0)
      .map((c) => {
        const first = c.messages[0].content;
        return {
          id: c.id,
          lastMessageAt: c.lastMessageAt.toISOString(),
          preview: first.length > PREVIEW_LENGTH ? `${first.slice(0, PREVIEW_LENGTH)}…` : first,
        };
      }),
  });
}
