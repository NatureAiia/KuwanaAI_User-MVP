"use client";

import { useEffect } from "react";
import { notifyGamification } from "@/lib/gamification/client";

/** Fires once per mount; the server dedupes to at most one XP award per day. */
export function DailyVisitPing() {
  useEffect(() => {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "daily_visit" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => notifyGamification(data?.gamification))
      .catch(() => {});
  }, []);

  return null;
}
