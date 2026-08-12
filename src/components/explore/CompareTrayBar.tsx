"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProviderLogo } from "@/components/ProviderLogo";
import { createClient } from "@/lib/supabase/client";
import { useCompareTray } from "@/lib/useCompareTray";
import { MIN_COMPARE, MAX_COMPARE } from "@/lib/compareTray";
import { stashPendingChatImage } from "@/lib/chatHandoff";

/**
 * A floating compare selection that persists across navigation — mount it on
 * any page (the explore grid, a listing's detail page) and it stays in sync
 * with every other mounted instance via `useCompareTray`'s storage event, so
 * checking a box on the grid, tapping into a listing to double-check
 * something, and coming back doesn't lose the selection.
 */
export function CompareTrayBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameraInputRef = useRef<HTMLInputElement>(null);
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
    // Carry the need-intake context (budget flexibility + stated constraints)
    // from the explore page through to the compare page so the AI
    // recommendation can be tailored to it.
    const budget = searchParams.get("budget");
    const constraint = searchParams.get("constraint");
    const params = new URLSearchParams({ category: tray.categoryId, ids: tray.items.map((i) => i.id).join(",") });
    if (budget) params.set("budget", budget);
    if (constraint) params.set("constraint", constraint);
    const target = `/explore/${tray.sectorSlug}/compare?${params.toString()}`;
    if (isAuthed === false) {
      router.push(`/signup?next=${encodeURIComponent(target)}`);
      return;
    }
    router.push(target);
  }

  // Photograph an item the user already knows (a product, a bill, a price
  // tag) and hand it to chat for identification — the same camera flow the
  // dashboard search bar uses. Sits right next to "Clear" so building a
  // comparison can include "things I know", not just catalog listings.
  function handleCameraChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(",");
      const mediaType = header.match(/data:(.*);base64/)?.[1] ?? file.type;
      if (!data) return;
      stashPendingChatImage({ mediaType, data, text: "This is an item I know — help me compare it." });
      router.push("/chat");
    };
    reader.onerror = () => {};
    reader.readAsDataURL(file);
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
          onClick={() => cameraInputRef.current?.click()}
          aria-label="Photograph an item you know"
          title="Add an item you already know — take a photo and chat will identify it"
          className="tap-target shrink-0 px-1 text-text-secondary hover:text-accent-sky"
        >
          <Camera size={16} />
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          capture="environment"
          className="hidden"
          onChange={handleCameraChange}
        />
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
