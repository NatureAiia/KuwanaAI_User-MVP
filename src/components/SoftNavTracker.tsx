"use client";

import { useEffect } from "react";

/**
 * Marks in-app (soft) navigations so route loading fallbacks can tell them
 * apart from hard loads. App Router fires history.pushState on every client
 * navigation but NOT on a full page load, and `pageshow` fires (and resets the
 * flag) after a hard load or bfcache restore. Consumers read the flag via
 * `isSoftNav()`; auth flows clear it before pushing so the full loading screen
 * still shows right after sign-in/sign-up.
 */
export function SoftNavTracker() {
  useEffect(() => {
    const win = window as Window & { __kuwanaSoftNav?: boolean };

    const mark = () => {
      win.__kuwanaSoftNav = true;
    };
    const onPageShow = () => {
      win.__kuwanaSoftNav = false;
    };

    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function (...args: Parameters<typeof origPush>) {
      mark();
      return origPush.apply(this, args);
    };
    window.history.replaceState = function (...args: Parameters<typeof origReplace>) {
      mark();
      return origReplace.apply(this, args);
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}

export function isSoftNav(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as Window & { __kuwanaSoftNav?: boolean }).__kuwanaSoftNav;
}

/** Tell the next route's loading fallback it should show the full loading screen. */
export function markHardNav() {
  if (typeof window === "undefined") return;
  (window as Window & { __kuwanaSoftNav?: boolean }).__kuwanaSoftNav = false;
}
