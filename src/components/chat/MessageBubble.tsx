import { clsx } from "clsx";
import { Sparkles } from "lucide-react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={clsx("flex items-end gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-gold/15 text-accent-gold">
          <Sparkles size={12} />
        </div>
      )}
      <div
        className={clsx(
          "max-w-[78%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-[1.5]",
          isUser
            ? "rounded-br-md bg-accent-gold text-[#14181d]"
            : "rounded-bl-md border border-border bg-bg-surface-raised text-text-primary",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
