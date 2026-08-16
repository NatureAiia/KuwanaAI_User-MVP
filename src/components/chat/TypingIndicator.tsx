import { Sparkles } from "lucide-react";

export function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex items-end justify-start gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-sky/15 text-accent-sky">
        <Sparkles size={12} />
      </div>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-bg-surface-raised px-3.5 py-3">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" />
        </span>
        {label && <span className="text-[12px] text-text-muted">{label}</span>}
      </div>
    </div>
  );
}
