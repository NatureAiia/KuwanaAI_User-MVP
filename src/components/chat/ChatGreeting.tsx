import { Compass, HelpCircle, TrendingDown, TrendingUp, Radar, ShieldAlert } from "lucide-react";

const CONSUMER_PROMPTS = [
  { label: "Compare data bundles", icon: Compass },
  { label: "Best savings accounts", icon: TrendingDown },
  { label: "What's trending right now?", icon: TrendingUp },
  { label: "How does the decision score work?", icon: HelpCircle },
];

const CORPORATE_PROMPTS = [
  { label: "How's my catalog pricing?", icon: TrendingUp },
  { label: "Do I have any triggered alerts?", icon: ShieldAlert },
  { label: "What's open in my investigations?", icon: Radar },
  { label: "What's my average listing price?", icon: Compass },
];

export function ChatGreeting({
  onPick,
  variant = "consumer",
}: {
  onPick: (prompt: string) => void;
  variant?: "consumer" | "corporate";
}) {
  const prompts = variant === "corporate" ? CORPORATE_PROMPTS : CONSUMER_PROMPTS;
  const heading =
    variant === "corporate" ? "What can I help with in your catalog today?" : "What are you comparing today?";

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <p className="font-display text-[26px] font-bold">{heading}</p>

      <div className="mt-8 flex w-full max-w-[360px] flex-col">
        {prompts.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(label)}
            className="tap-target flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-medium text-text-secondary hover:bg-bg-surface-raised hover:text-text-primary"
          >
            <Icon size={16} className="shrink-0 text-text-muted" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
