"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 20_000;

/**
 * Keeps a server-rendered page fresh via router.refresh() on an interval —
 * the "near-real-time" approach chosen over a WebSocket/SSE push layer
 * (matches how Notifications already works: re-synced on view, not pushed).
 * Renders nothing; mount it once anywhere in the page tree.
 */
export function LiveFeedRefresher() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
