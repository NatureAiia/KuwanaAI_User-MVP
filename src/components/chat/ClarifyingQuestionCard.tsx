"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export type ClarifyField = { field: string; question: string; options: string[] | null };

/**
 * Renders below an assistant turn that asked for more context instead of
 * answering (see STREAM_CLARIFY_MARKER / resolveChatIntent() in
 * intakeClassifier.ts) — a quick-reply chip per option, or a small free-text
 * input when the field has none. Either path just calls `onReply(text)`,
 * which ChatClient wires straight to sendMessage() — the reply becomes the
 * next ordinary user message, no separate state machine.
 */
export function ClarifyingQuestionCard({
  fields,
  onReply,
}: {
  fields: ClarifyField[];
  onReply?: (text: string) => void;
}) {
  return (
    <div className="ml-0 mt-2 flex max-w-[92%] flex-col gap-2.5">
      {fields.map((f) => (
        <ClarifyFieldRow key={f.field} field={f} onReply={onReply} />
      ))}
    </div>
  );
}

function ClarifyFieldRow({ field, onReply }: { field: ClarifyField; onReply?: (text: string) => void }) {
  const [draft, setDraft] = useState("");

  function submitDraft() {
    const value = draft.trim();
    if (!value) return;
    onReply?.(value);
    setDraft("");
  }

  return (
    <div className="rounded-xl border border-border bg-bg-surface px-3 py-2.5">
      <p className="text-[12.5px] font-medium text-text-secondary">{field.question}</p>
      {field.options && field.options.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {field.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onReply?.(opt)}
              className="tap-target rounded-full border border-accent-sky/40 px-3 py-1.5 text-[12px] font-semibold text-accent-sky hover:bg-accent-sky/10"
            >
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitDraft();
            }}
            placeholder="Type your answer…"
            className="tap-target flex-1 rounded-lg border border-border bg-bg-base px-2.5 py-1.5 text-[12.5px]"
          />
          <button
            type="button"
            onClick={submitDraft}
            aria-label="Send"
            disabled={!draft.trim()}
            className="tap-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-sky text-[var(--text-on-accent-sky)] disabled:opacity-40"
          >
            <Send size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
