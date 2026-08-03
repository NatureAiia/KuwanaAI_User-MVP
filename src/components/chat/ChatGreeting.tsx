import { Bot, Compass, HelpCircle, TrendingDown, TrendingUp } from "lucide-react";

const SUGGESTED_PROMPTS = [
  { label: "Compare data bundles", icon: Compass },
  { label: "Best savings accounts", icon: TrendingDown },
  { label: "What's trending right now?", icon: TrendingUp },
  { label: "How does the decision score work?", icon: HelpCircle },
];

export function ChatGreeting({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-gold/15 text-accent-gold">
        <Bot size={26} />
      </div>
      <p className="mt-4 font-display text-[17px] font-bold">Hey there!</p>
      <p className="mt-1 max-w-[280px] text-[13px] text-text-secondary">
        I&apos;m the Kuwana Assistant. Ask me about providers, comparisons, or how to get the best value.
      </p>

      <div className="mt-6 grid w-full grid-cols-2 gap-2.5">
        {SUGGESTED_PROMPTS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPick(label)}
            className="tap-target flex items-center gap-2 rounded-xl border border-border bg-bg-surface p-3 text-left text-[12.5px] font-medium text-text-secondary hover:border-accent-gold/50 hover:text-accent-gold"
          >
            <Icon size={15} className="shrink-0 text-accent-teal" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
