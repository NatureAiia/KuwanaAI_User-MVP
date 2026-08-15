"use client";

import { Plus } from "lucide-react";
import { clsx } from "clsx";

export type ChatThread = {
  id: string;
  lastMessageAt: string;
  preview: string;
};

/**
 * Horizontal pill row of the user's own conversations, same visual pattern
 * as the alerts/business-conditions filter pills elsewhere in the app —
 * deliberately not a full sidebar, since a chat thread list here is a
 * lightweight "pick up where you left off" switcher, not a primary nav.
 */
export function ChatThreadBar({
  threads,
  activeId,
  onSelect,
  onNewChat,
}: {
  threads: ChatThread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  if (threads.length === 0) return null;

  return (
    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={onNewChat}
        className={clsx(
          "tap-target flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-medium",
          activeId === null
            ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
            : "border-border text-text-secondary hover:bg-bg-surface-raised",
        )}
      >
        <Plus size={13} />
        New
      </button>
      {threads.map((thread) => (
        <button
          key={thread.id}
          type="button"
          onClick={() => onSelect(thread.id)}
          title={thread.preview}
          className={clsx(
            "tap-target max-w-[180px] shrink-0 truncate rounded-full border px-3 py-1.5 text-[12px] font-medium",
            activeId === thread.id
              ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
              : "border-border text-text-secondary hover:bg-bg-surface-raised",
          )}
        >
          {thread.preview}
        </button>
      ))}
    </div>
  );
}
