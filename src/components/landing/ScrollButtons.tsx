"use client";

import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { clsx } from "clsx";

export function ScrollButtons() {
  const [showUp, setShowUp] = useState(false);
  const [showDown, setShowDown] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const { scrollY, innerHeight } = window;
      const scrollHeight = document.documentElement.scrollHeight;
      setShowUp(scrollY > 400);
      setShowDown(scrollY + innerHeight < scrollHeight - 200);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 right-5 z-30 hidden flex-col items-center gap-2 md:flex">
      <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">Scroll</span>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to top"
        tabIndex={showUp ? 0 : -1}
        className={clsx(
          "tap-target flex items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary shadow-md transition-opacity duration-300 hover:text-accent-sky",
          showUp ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ChevronUp size={16} />
      </button>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })}
        aria-label="Scroll to bottom"
        tabIndex={showDown ? 0 : -1}
        className={clsx(
          "tap-target flex items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary shadow-md transition-opacity duration-300 hover:text-accent-sky",
          showDown ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <ChevronDown size={16} />
      </button>
    </div>
  );
}
