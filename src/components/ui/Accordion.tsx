"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

export function Accordion({
  items,
}: {
  items: readonly { question: string; answer: string }[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-surface">
      {items.map((item, index) => {
        const open = openIndex === index;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : index)}
              aria-expanded={open}
              className="tap-target flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-[14px] font-semibold">{item.question}</span>
              <ChevronDown
                size={18}
                className={clsx(
                  "shrink-0 text-text-muted transition-transform",
                  open && "rotate-180",
                )}
              />
            </button>
            {open && (
              <p className="px-5 pb-4 text-[13px] leading-[1.6] text-text-secondary">
                {item.answer}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
