"use client";

import { useEffect, useRef, useState } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatGreeting } from "@/components/chat/ChatGreeting";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { MessageBubble, type ChatMessage } from "@/components/chat/MessageBubble";
import { notifyGamification } from "@/lib/gamification/client";

const ERROR_REPLY = "Sorry, I couldn't reach the assistant just now. Please try again.";

export function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrating, setHydrating] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.messages) setMessages(data.messages);
      })
      .catch(() => {})
      .finally(() => setHydrating(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(content: string) {
    setMessages((prev) => [...prev, { id: `local-${prev.length}`, role: "user", content }]);
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("chat request failed");
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      notifyGamification(data.gamification);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `error-${prev.length}`, role: "assistant", content: ERROR_REPLY },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col pb-40 md:pb-28">
      <ChatHeader />

      <div className="mt-4 flex flex-1 flex-col gap-3">
        {hydrating ? (
          <p className="py-10 text-center text-[13px] text-text-muted">Loading conversation…</p>
        ) : messages.length === 0 ? (
          <ChatGreeting onPick={sendMessage} />
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        {sending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-bg-surface/95 px-5 py-3 backdrop-blur-sm md:bottom-0 md:px-10">
        <ChatComposer onSend={sendMessage} disabled={sending || hydrating} />
      </div>
    </div>
  );
}
