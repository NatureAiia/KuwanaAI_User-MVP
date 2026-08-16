export function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" />
      </span>
      {label && <span className="text-[12px] text-text-muted">{label}</span>}
    </div>
  );
}
