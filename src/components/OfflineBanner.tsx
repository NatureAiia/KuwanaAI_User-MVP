"use client";

import { useOffline } from "next/offline";

/**
 * Sitewide connectivity notice — pairs with `experimental.useOffline` in
 * next.config.ts. That flag keeps a dropped-connection navigation or Server
 * Action pending instead of throwing, so without this the UI would just look
 * frozen; this tells the user why and that it isn't a bug.
 */
export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 bg-accent-coral px-4 py-1.5 text-center text-[12px] font-medium text-white"
    >
      You&apos;re offline. Anything you do here will pick back up once you&apos;re back online.
    </div>
  );
}
