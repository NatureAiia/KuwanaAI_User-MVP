import { clsx } from "clsx";
import { Clock, Sparkles } from "lucide-react";
import { ChatListingPreview } from "@/components/chat/ChatListingPreview";

export type ChatListingSummary = {
  id: string;
  name: string;
  price: number;
  currency: string;
  provider: string;
  categoryId: string;
  sectorSlug: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  listings?: ChatListingSummary[];
  status?: "sending";
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div>
      <div className={clsx("flex items-end gap-1.5", isUser ? "justify-end" : "justify-start")}>
        {!isUser && (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-sky/15 text-accent-sky">
            <Sparkles size={12} />
          </div>
        )}
        <div
          className={clsx(
            "max-w-[78%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-[1.5]",
            isUser
              ? "rounded-br-md bg-accent-sky text-[var(--text-on-accent-sky)]"
              : "rounded-bl-md border border-border bg-bg-surface-raised text-text-primary",
          )}
        >
          {message.content}
        </div>
        {isUser && message.status === "sending" && (
          <Clock size={12} className="mb-1 shrink-0 text-text-muted" aria-label="Sending" />
        )}
      </div>
      {!isUser && message.listings && message.listings.length > 0 && (
        <ChatListingPreview listings={message.listings} />
      )}
    </div>
  );
}
