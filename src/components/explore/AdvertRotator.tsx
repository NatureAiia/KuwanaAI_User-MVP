"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import NeonBorder from "@/components/ui/NeonBorder";
import Text3DFlip from "@/components/ui/Text3DFlip";
import { AdvertLightbox } from "@/components/explore/AdvertLightbox";

export type AdvertData = { id: string; sponsorName: string; tagline: string; imageUrl: string };

const ROTATE_MS = 60_000;
// NeonBorder string-parses its `color` prop (hex/rgb only, no CSS vars), so
// this is the literal value behind --accent-teal (dark theme) — vivid enough
// to read as "neon" against either theme's background.
const KUWANA_GREEN = "#2dd4bf";

export function AdvertRotator({ adverts }: { adverts: AdvertData[] }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (adverts.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % adverts.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [adverts.length]);

  if (adverts.length === 0) return null;
  const current = adverts[index % adverts.length];

  async function handleOpen() {
    setLightboxOpen(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "advert_opened" }),
      });
      if (!res.ok) console.error("[adverts] failed to record open:", await res.text());
    } catch (err) {
      console.error("[adverts] failed to record open:", err);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Open ${current.sponsorName} advert`}
        className="mx-auto mt-6 block w-full max-w-[360px] text-left"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[24px]">
          <Image
            src={current.imageUrl}
            alt={current.sponsorName}
            fill
            className="rounded-[24px] object-cover"
            sizes="360px"
          />
          <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Sponsored
          </span>
          <div className="pointer-events-none absolute inset-0">
            <NeonBorder rounded={24} color={KUWANA_GREEN} thickness={9} glow={140} />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center gap-2">
          <Image src="/kuwana-mark.png" alt="" width={20} height={20} className="shrink-0" />
          <div className="h-[20px] overflow-hidden">
            {/* key=current.id forces a fresh mount (and flip-in) when the advert
                itself rotates, on top of the intervalMs loop replaying the same
                flip every 2s while this advert is showing. */}
            <Text3DFlip
              key={current.id}
              text={current.tagline}
              tag="span"
              animation="enter"
              intervalMs={2000}
              staggerDuration={0}
              color="var(--accent-teal)"
              font={{
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 600,
                lineHeight: "20px",
                letterSpacing: "0",
                textAlign: "center",
              }}
            />
          </div>
        </div>
      </button>

      {lightboxOpen && (
        <AdvertLightbox
          imageUrl={current.imageUrl}
          sponsorName={current.sponsorName}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
