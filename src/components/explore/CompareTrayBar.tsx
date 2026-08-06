"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProviderLogo } from "@/components/ProviderLogo";
import { createClient } from "@/lib/supabase/client";
import { useCompareTray } from "@/lib/useCompareTray";
import { MIN_COMPARE, MAX_COMPARE } from "@/lib/compareTray";

/**
 * A floating compare selection that persists across navigation — mount it on
 * any page (the explore grid, a listing's detail page) and it stays in sync
 * with every other mounted instance via `useCompareTray`'s storage event, so
 * checking a box on the grid, tapping into a listing to double-check
 * something, and coming back doesn't lose the selection.
 */
export function CompareTrayBar() {
  const router = useRouter();
  const { tray, remove, clear } = useCompareTray();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setIsAuthed(!!data.user));
  }, []);

  if (!tray || tray.items.length === 0) return null;

  function goCompare() {
    if (!tray || tray.items.length < MIN_COMPARE) return;
    const target = `/explore/${tray.sectorSlug}/compare?category=${tray.categoryId}&ids=${tray.items
      .map((i) => i.id)
      .join(",")}`;
    if (isAuthed === false) {
      router.push(`/signup?next=${encodeURIComponent(target)}`);
      return;
    }
    router.push(target);
  }

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 flex justify-center px-5 md:bottom-6">
      <div className="flex max-w-full items-center gap-3 rounded-full border border-accent-sky bg-bg-surface px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {tray.items.map((item) => (
            <span
              key={item.id}
              className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-bg-surface-raised py-1 pl-1.5 pr-1 text-[12px] font-medium"
            >
              <ProviderLogo name={item.providerName} logoUrl={item.providerLogoUrl} size={16} />
              <span className="max-w-[80px] truncate">{item.name}</span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Deselect ${item.name}`}
                className="tap-target flex h-6 w-6 items-center justify-center rounded-full text-text-muted hover:text-accent-coral"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>

        <span className="shrink-0 text-[12px] font-medium text-text-muted">
          {tray.items.length < MIN_COMPARE
            ? `${MIN_COMPARE - tray.items.length} more`
            : `${tray.items.length}/${MAX_COMPARE}`}
        </span>

        <Button size="md" onClick={goCompare} disabled={tray.items.length < MIN_COMPARE} className="shrink-0">
          Compare
        </Button>
        <button
          type="button"
          onClick={clear}
          className="tap-target shrink-0 px-1 text-[12px] font-medium text-text-muted hover:text-text-primary"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
