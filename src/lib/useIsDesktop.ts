"use client";

import { useSyncExternalStore } from "react";

// Matches Tailwind's default `md` breakpoint, so this agrees with any
// `md:` classes styling the same layout.
const QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/**
 * False on the server, where there is no viewport to measure — so the
 * mobile branch is what gets server-rendered, and React swaps in the desktop
 * branch during hydration if the media query actually matches.
 */
function getServerSnapshot() {
  return false;
}

/**
 * useSyncExternalStore rather than useState + useEffect.
 *
 * The previous version called `setIsDesktop(mql.matches)` synchronously
 * inside the effect, which React flags (`react-hooks/set-state-in-effect`):
 * it renders once with the default, then immediately re-renders with the
 * real value, so every consumer paints the mobile layout for a frame before
 * correcting. This hook is subscribing to an external source, which is
 * exactly what useSyncExternalStore exists for — it reads the current value
 * during render instead of after it, and handles the server snapshot
 * explicitly.
 */
export function useIsDesktop() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
