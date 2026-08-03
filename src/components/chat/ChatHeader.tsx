import { Sparkles } from "lucide-react";

export function ChatHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-sky/15 text-accent-sky">
        <Sparkles size={20} />
      </div>
      <div>
        <p className="font-display text-[15px] font-semibold leading-tight">Kuwana Assistant</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-teal" />
          AI Assistant · Online
        </p>
      </div>
    </div>
  );
}
