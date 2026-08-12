import Text3DFlip from "@/components/ui/Text3DFlip";

/** Small in-app-navigation loading state — a spinner plus the animated
 * wordmark (flips every 8s for as long as this stays mounted). */
export function SoftNavSpinner() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Text3DFlip
        text="kuwana.ai"
        tag="span"
        animation="enter"
        intervalMs={8000}
        color="var(--accent-teal)"
        font={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 700,
          lineHeight: "1em",
          letterSpacing: "-0.025em",
          textAlign: "center",
        }}
        style={{ width: "auto", height: "auto", display: "inline-flex" }}
      />
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-sky border-t-transparent" />
    </div>
  );
}
