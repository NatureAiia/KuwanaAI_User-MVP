"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { clsx } from "clsx";

/**
 * App-wide floating back-to-top button, distinct from the landing page's
 * inline pill (components/landing/BackToTopButton.tsx). Sits on the
 * opposite corner from the Quests FAB (bottom-right, see BottomTabBar) so
 * the two never overlap, and clears the mobile tab bar the same way it does.
 */
export function GlobalBackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 480);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      className={clsx(
        "tap-target fixed bottom-20 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-surface/95 text-text-secondary shadow-[0_10px_30px_-12px_rgba(2,6,23,0.55)] backdrop-blur-sm transition-all hover:border-accent-sky/40 hover:text-accent-sky md:bottom-6 md:left-6 print:hidden",
        visible ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <ChevronUp size={20} />
    </button>
  );
}
