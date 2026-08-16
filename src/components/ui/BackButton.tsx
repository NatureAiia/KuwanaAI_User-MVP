"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { clsx } from "clsx";

/**
 * Returns to wherever the user actually came from (in-app history), not a
 * hardcoded parent route — these pages (notifications, wallet, settings, …)
 * are reachable from several different places via Header's icon cluster, so
 * a fixed "back to X" link would be wrong as often as it's right. Falls back
 * to fallbackHref only when there's no in-app history to go back to (e.g. a
 * deep link opened directly).
 */
export function BackButton({
  fallbackHref = "/dashboard",
  label = "Go back",
  className,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      aria-label={label}
      className={clsx(
        "tap-target -ml-2 flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary",
        className,
      )}
    >
      <ArrowLeft size={20} />
    </button>
  );
}
