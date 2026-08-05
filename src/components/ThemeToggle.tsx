"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";

export function ThemeToggle({ className }: { className?: string }) {
  // Default matches layout.tsx's hardcoded `className="dark"` and its
  // pre-hydration theme-init script, whose default is also dark — this must
  // stay in sync with that SSR default, or this button's aria-label/icon
  // will mismatch between server and client render and trigger a hydration
  // error (see layout.tsx's THEME_INIT_SCRIPT).
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Reconciles with the actual class the pre-hydration script set from
    // localStorage — only differs from the SSR default when it's "light".
    const actual = document.documentElement.classList.contains("dark");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the DOM class an external script set before hydration, not deriving render output
    if (actual !== isDark) setIsDark(actual);
  }, [isDark]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("kuwana-theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={clsx(
        "tap-target flex items-center justify-center rounded-full border border-border bg-bg-surface text-text-secondary",
        className,
      )}
    >
      {isDark ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
