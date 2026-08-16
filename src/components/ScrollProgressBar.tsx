"use client";

import { useEffect, useState } from "react";

/** Thin top-of-viewport bar showing how far down the current page the user has scrolled. */
export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      const scrollable = scrollHeight - clientHeight;
      setProgress(scrollable > 0 ? (scrollTop / scrollable) * 100 : 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent print:hidden"
    >
      <div
        className="h-full bg-accent-sky transition-[width] duration-100 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
