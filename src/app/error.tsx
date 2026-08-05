"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Server-side equivalent of an unhandled rejection — surfaced here since
    // there's no error-tracking service (Sentry/etc.) wired up yet.
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center">
      <AlertTriangle size={40} className="text-accent-coral" />
      <h1 className="mt-4 font-display text-[22px] font-bold">Something went wrong</h1>
      <p className="mt-2 max-w-[320px] text-[14px] text-text-secondary">
        That&apos;s on us, not you. Try again, or head back and pick up where you left off.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset} size="lg">
          Try again
        </Button>
        <LinkButton href="/dashboard" variant="secondary" size="lg">
          Go home
        </LinkButton>
      </div>
    </div>
  );
}
