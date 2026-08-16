import { Check, Loader2, Circle, X } from "lucide-react";
import { clsx } from "clsx";
import { DynamicBar } from "@/components/ui/DynamicBar";

export type ProgressStepState = "pending" | "active" | "done" | "error";
export type ProgressStep = { key: string; label: string; state: ProgressStepState };

function StepIcon({ state }: { state: ProgressStepState }) {
  switch (state) {
    case "done":
      return <Check size={14} className="shrink-0 text-accent-teal" />;
    case "active":
      return <Loader2 size={14} className="shrink-0 animate-spin text-accent-sky" />;
    case "error":
      return <X size={14} className="shrink-0 text-accent-coral" />;
    default:
      return <Circle size={8} className="mx-[3px] shrink-0 text-text-muted" />;
  }
}

/**
 * Replaces a bare spinner/"Loading…" for operations that genuinely run in
 * named sequential steps — only use this where the steps are real (don't
 * invent stages a process doesn't actually go through).
 */
export function ProgressSteps({ steps, className }: { steps: ProgressStep[]; className?: string }) {
  const doneCount = steps.filter((s) => s.state === "done").length;
  const hasError = steps.some((s) => s.state === "error");

  return (
    <div className={clsx("w-full", className)}>
      <DynamicBar
        value={(doneCount / steps.length) * 100}
        color={hasError ? "coral" : "teal"}
        ariaLabel="Progress"
      />
      <ul className="mt-3 flex flex-col gap-1.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-[12.5px]">
            <StepIcon state={s.state} />
            <span className={s.state === "pending" ? "text-text-muted" : "text-text-secondary"}>
              {s.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
