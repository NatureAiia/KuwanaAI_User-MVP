import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";

const TONE_CLASSES = {
  sky: "bg-accent-sky/10 text-accent-sky",
  teal: "bg-accent-teal/10 text-accent-teal",
  coral: "bg-accent-coral/10 text-accent-coral",
  neutral: "bg-bg-surface-raised text-text-muted",
} as const;

// The "Key insights" stat card: an icon chip + a headline value, the same
// shape as ui/Card.tsx's Badge/CorporateTag tone formula (10%-tint icon
// background) so it reads as part of the same system rather than a
// one-off borrowed from a different design language.
export function CorporateStatCard({
  icon: Icon,
  tone = "neutral",
  label,
  children,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="!p-3.5">
      <div className="flex items-start gap-3">
        <span className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES[tone])}>
          <Icon size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-text-muted">{label}</p>
          <div className="mt-0.5">{children}</div>
        </div>
      </div>
    </Card>
  );
}
