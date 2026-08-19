"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type Role = "consumer" | "corporate" | "provider" | "regulator";

// sessionStorage rather than a DB column or localStorage: this is a purely
// presentational one-time nudge (see the WelcomeModal comment below), not
// state anything server-side needs to know about, and sessionStorage means
// it resurfaces on the next real session (a fresh sign-in) rather than being
// gone forever after the first tab — closer to "don't repeat within this
// visit" than "never again".
const STORAGE_PREFIX = "kuwana_welcome_shown_";

/**
 * Fires once, right after landing on the post-signup destination
 * (/dashboard for consumer, /{role} for corporate/provider/regulator — see
 * the router.push() at the end of the profile-save effect in
 * src/app/signup/page.tsx). Two variants:
 *
 *  - consumer: celebratory "thanks for joining" — dismissing it surfaces a
 *    lightweight one-time follow-up nudge toward wallet/leaderboard/notes/
 *    chat/recommendations.
 *  - applicant (corporate/provider/regulator): calmer "application
 *    received" — their account is fully usable right now; applicationStatus
 *    is informational only (see the User model), not a gate.
 *
 * `userId` keys the one-time flag so a different account signing in on the
 * same browser still gets its own first-run popup.
 */
export function WelcomeModal({ userId, role }: { userId: string; role: Role }) {
  const variant: "consumer" | "applicant" = role === "consumer" ? "consumer" : "applicant";
  const storageKey = `${STORAGE_PREFIX}${userId}`;

  const [open, setOpen] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(storageKey)) return;
    // Syncing from sessionStorage (an external system unreadable during SSR),
    // not deriving render output — same exception as ThemeToggle.tsx's
    // DOM-class sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only store on mount, can't be known during SSR
    setOpen(true);
    sessionStorage.setItem(storageKey, "1");
  }, [storageKey]);

  function dismiss() {
    setOpen(false);
    if (variant === "consumer") setShowFollowUp(true);
  }

  if (!open && !showFollowUp) return null;

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={variant === "consumer" ? "Welcome to Kuwana" : "Application received"}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-5"
        >
          <div className="w-full max-w-[420px] rounded-[var(--radius-card)] border border-border bg-bg-surface p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-center gap-2">
              <Image src="/kuwana-mark.png" alt="" width={32} height={32} />
              <span className="font-display text-xl font-bold">kuwana.ai</span>
            </div>
            {variant === "consumer" ? (
              <>
                <h2 className="mt-5 font-display text-[20px] font-bold">
                  Thank you for joining Kuwana.ai
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                  Your account is ready. Start comparing telecom, banking, insurance, and health
                  products tailored to you — and track how much you save as you go.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-5 font-display text-[20px] font-bold">Application received</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                  Your account is fully set up and ready to use right now. Our team is reviewing
                  your application in the background — we&apos;ll be in touch if we need anything
                  else.
                </p>
              </>
            )}
            <Button onClick={dismiss} className="mt-6 w-full">
              Get started
            </Button>
          </div>
        </div>
      )}

      {showFollowUp && (
        <div className="fixed bottom-20 left-1/2 z-[150] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-accent-sky/40 bg-bg-surface p-4 text-[13px] shadow-[0_8px_30px_rgba(0,0,0,0.3)] md:bottom-6">
          <button
            type="button"
            onClick={() => setShowFollowUp(false)}
            aria-label="Dismiss"
            className="float-right -mt-1 -mr-1 rounded-full p-1 text-text-muted hover:text-text-primary"
          >
            ✕
          </button>
          <p className="font-semibold text-text-primary">A few things worth a look</p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <Link href="/wallet" className="text-accent-sky hover:underline">
                Set up your wallet
              </Link>
            </li>
            <li>
              <Link href="/leaderboard" className="text-accent-sky hover:underline">
                Join the leaderboard
              </Link>
            </li>
            <li>
              <Link href="/profile/notes" className="text-accent-sky hover:underline">
                Jot down your notes
              </Link>
            </li>
            <li>
              <Link href="/chat" className="text-accent-sky hover:underline">
                Chat with the AI assistant
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="text-accent-sky hover:underline">
                See your AI recommendations
              </Link>
            </li>
          </ul>
        </div>
      )}
    </>
  );
}
