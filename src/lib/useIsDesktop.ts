"use client";

import { useEffect, useState } from "react";

// Matches Tailwind's default `md` breakpoint, so this agrees with any
// `md:` classes styling the same layout.
const QUERY = "(min-width: 768px)";

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setIsDesktop(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}
