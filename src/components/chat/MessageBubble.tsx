import { clsx } from "clsx";
import { Clock } from "lucide-react";
import Markdown from "react-markdown";
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

/* eslint-disable @typescript-eslint/no-unused-vars -- each override destructures `node` only to keep it out of the DOM spread below */
/** Compact Markdown element styling to match the chat bubble's small, tight typography. */
const MARKDOWN_COMPONENTS = {
  p: ({ node: _node, ...props }) => <p className="mt-1.5 first:mt-0" {...props} />,
  h1: ({ node: _node, ...props }) => <p className="mt-2 font-display text-[14.5px] font-bold first:mt-0" {...props} />,
  h2: ({ node: _node, ...props }) => <p className="mt-2 font-display text-[14.5px] font-bold first:mt-0" {...props} />,
  h3: ({ node: _node, ...props }) => <p className="mt-2 font-display text-[14px] font-bold first:mt-0" {...props} />,
  ul: ({ node: _node, ...props }) => <ul className="mt-1.5 list-disc space-y-0.5 pl-4 first:mt-0" {...props} />,
  ol: ({ node: _node, ...props }) => <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 first:mt-0" {...props} />,
  li: ({ node: _node, ...props }) => <li {...props} />,
  strong: ({ node: _node, ...props }) => <strong className="font-semibold" {...props} />,
  em: ({ node: _node, ...props }) => <em className="text-text-secondary" {...props} />,
  a: ({ node: _node, ...props }) => (
    <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />
  ),
  code: ({ node: _node, ...props }) => (
    <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[12px] dark:bg-white/10" {...props} />
  ),
} satisfies import("react-markdown").Components;
/* eslint-enable @typescript-eslint/no-unused-vars */

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div>
      <div className={clsx("flex items-end gap-1.5", isUser ? "justify-end" : "justify-start")}>
        {isUser ? (
          <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-sky px-3.5 py-2.5 text-[13.5px] leading-[1.5] text-[var(--text-on-accent-sky)]">
            {message.content}
          </div>
        ) : (
          <div className="w-full text-[13.5px] leading-[1.6] text-text-primary">
            <Markdown components={MARKDOWN_COMPONENTS}>{message.content}</Markdown>
          </div>
        )}
        {isUser && message.status === "sending" && (
          <Clock size={12} className="mb-1 shrink-0 text-text-muted" aria-label="Sending" />
        )}
      </div>
      {!isUser && message.listings && message.listings.length > 0 && (
        <ChatListingPreview listings={message.listings} />
      )}
      {!isUser && message.content && (
        <p className="mt-1 text-center text-[10.5px] italic text-text-muted">
          I&apos;m an AI assistant, not a financial advisor.
        </p>
      )}
    </div>
  );
}
