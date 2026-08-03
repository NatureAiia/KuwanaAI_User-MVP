"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export function ChatComposer({
  onSend,
  disabled,
}: {
  onSend: (content: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-full border border-border bg-bg-surface-raised px-2 py-1.5">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask the Kuwana Assistant…"
          disabled={disabled}
          className="flex-1 bg-transparent px-2 text-[13.5px] text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className="tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-gold text-[#14181d] disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
      <p className="mt-2 text-center text-[10.5px] text-text-muted">
        AI-assisted. Not financial advice — verify details before deciding.
      </p>
    </div>
  );
}
