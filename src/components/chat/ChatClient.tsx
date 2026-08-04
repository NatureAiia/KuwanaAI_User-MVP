"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link2 } from "lucide-react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatGreeting } from "@/components/chat/ChatGreeting";
import { ChatComposer, type ComposerImage } from "@/components/chat/ChatComposer";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { DateDivider } from "@/components/chat/DateDivider";
import { MessageBubble, type ChatMessage } from "@/components/chat/MessageBubble";
import { notifyGamification } from "@/lib/gamification/client";
import { STREAM_META_MARKER, STREAM_ERROR_MARKER } from "@/lib/chatStream";

const ERROR_REPLY = "Sorry, I couldn't reach the assistant just now. Please try again.";
// Covers a marker split across two chunk reads at the boundary.
const SAFETY_MARGIN = Math.max(STREAM_META_MARKER.length, STREAM_ERROR_MARKER.length) - 1;

export function ChatClient() {
  const searchParams = useSearchParams();
  const [activeListingIds] = useState<string[]>(() => {
    const raw = searchParams.get("listingIds");
    return raw ? raw.split(",").filter(Boolean) : [];
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrating, setHydrating] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        // Guard against a send that happened while this was in flight —
        // never clobber messages the user already added.
        if (data?.messages) setMessages((prev) => (prev.length === 0 ? data.messages : prev));
      })
      .catch(() => {})
      .finally(() => setHydrating(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(content: string, image?: ComposerImage) {
    const pendingId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: pendingId,
        role: "user",
        content: content || "[Image attached]",
        createdAt: new Date().toISOString(),
        status: "sending",
      },
    ]);
    setSending(true);

    let assistantId: string | null = null;
    let shown = 0;

    function appendDelta(delta: string) {
      if (!delta) return;
      if (!assistantId) {
        assistantId = `stream-${Date.now()}`;
        const newId = assistantId;
        setMessages((prev) => [
          ...prev.map((m) => (m.id === pendingId ? { ...m, status: undefined } : m)),
          { id: newId, role: "assistant", content: delta },
        ]);
      } else {
        const id = assistantId;
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + delta } : m)));
      }
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          listingIds: activeListingIds.length > 0 ? activeListingIds : undefined,
          image,
        }),
      });
      if (!res.ok || !res.body) throw new Error("chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });

        const errIdx = buffer.indexOf(STREAM_ERROR_MARKER);
        const metaIdx = buffer.indexOf(STREAM_META_MARKER);

        if (errIdx !== -1) {
          appendDelta(buffer.slice(shown, errIdx));
          throw new Error("assistant stream reported failure");
        }
        if (metaIdx !== -1) {
          appendDelta(buffer.slice(shown, metaIdx));
          const meta = JSON.parse(buffer.slice(metaIdx + STREAM_META_MARKER.length));
          const id = assistantId;
          if (id) setMessages((prev) => prev.map((m) => (m.id === id ? meta.message : m)));
          notifyGamification(meta.gamification);
          break;
        }
        if (done) break;

        const safeLen = Math.max(0, buffer.length - SAFETY_MARGIN);
        if (safeLen > shown) {
          appendDelta(buffer.slice(shown, safeLen));
          shown = safeLen;
        }
      }

      if (!assistantId) throw new Error("assistant produced no reply");
    } catch {
      setMessages((prev) => {
        const cleared = prev.map((m) => (m.id === pendingId ? { ...m, status: undefined } : m));
        if (assistantId) {
          const id = assistantId;
          return cleared.map((m) => (m.id === id ? { ...m, content: ERROR_REPLY } : m));
        }
        return [
          ...cleared,
          { id: `error-${Date.now()}`, role: "assistant", content: ERROR_REPLY, createdAt: new Date().toISOString() },
        ];
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col pb-40 md:pb-28">
      <ChatHeader />

      {activeListingIds.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-accent-sky/30 bg-accent-sky/5 px-3 py-2 text-[11.5px] font-medium text-accent-sky">
          <Link2 size={13} />
          Discussing {activeListingIds.length} listing{activeListingIds.length > 1 ? "s" : ""} from your comparison
        </div>
      )}

      <div className="mt-4 flex flex-1 flex-col gap-3">
        {hydrating ? (
          <p className="py-10 text-center text-[13px] text-text-muted">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <ChatGreeting onPick={sendMessage} />
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const showDivider =
              !prev || (m.createdAt && prev.createdAt && new Date(m.createdAt).toDateString() !== new Date(prev.createdAt).toDateString());
            return (
              <div key={m.id}>
                {showDivider && m.createdAt && <DateDivider date={new Date(m.createdAt)} />}
                <MessageBubble message={m} />
              </div>
            );
          })
        )}
        {sending && !messages.some((m) => m.id.startsWith("stream-")) && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-bg-surface/95 px-5 py-3 backdrop-blur-sm md:bottom-0 md:px-10">
        <ChatComposer onSend={sendMessage} disabled={sending || hydrating} />
      </div>
    </div>
  );
}
