"use client";

import { useEffect } from "react";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
const STORAGE_KEY = "kuwana-utm";

/**
 * Captures utm_* params off the first-touch URL and stashes them in
 * sessionStorage so signup/attribution can read them later in the flow —
 * by the time a visitor reaches /signup the params are usually long gone
 * from the URL. First-touch only: an existing stored value is never
 * overwritten by a later page's (possibly empty) query string.
 */
export function UtmTracker() {
  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const captured: Record<string, string> = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) captured[key] = value;
    }

    if (Object.keys(captured).length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
    }
  }, []);

  return null;
}

/** Reads back whatever UTM params were captured for this session, if any. */
export function getStoredUtm(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
