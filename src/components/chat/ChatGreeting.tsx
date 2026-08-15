import { Bot, Compass, HelpCircle, TrendingDown, TrendingUp, Radar, ShieldAlert } from "lucide-react";

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

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-sky/15 text-accent-sky">
        <Bot size={26} />
      </div>
      <p className="mt-4 font-display text-[17px] font-bold">Hey there!</p>
      <p className="mt-1 max-w-[280px] text-[13px] text-text-secondary">
        {variant === "corporate"
          ? "I'm the Kuwana Business Assistant. Ask me about your catalog, alerts, or investigations."
          : "I'm the Kuwana Assistant. Ask me about providers, comparisons, or how to get the best value."}
      </p>

      <div className="mt-6 grid w-full grid-cols-2 gap-2.5">
        {prompts.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(label)}
            className="tap-target flex items-center gap-2 rounded-xl border border-border bg-bg-surface p-3 text-left text-[12.5px] font-medium text-text-secondary hover:border-accent-sky/50 hover:text-accent-sky"
          >
            <Icon size={15} className="shrink-0 text-accent-teal" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
