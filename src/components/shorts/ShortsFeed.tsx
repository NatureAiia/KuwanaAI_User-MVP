"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AdvertLightbox } from "@/components/explore/AdvertLightbox";
import type { ShortsCard } from "@/lib/shorts";

const AUTOPLAY_MS = 4000;

function recordAdvertOpened() {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType: "advert_opened" }),
  }).catch((err) => console.error("[shorts] failed to record advert open:", err));
}

export function ShortsFeed({ cards }: { cards: ShortsCard[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [openAdvert, setOpenAdvert] = useState<Extract<ShortsCard, { kind: "advert" }> | null>(null);

  // Auto-random-play: advance to the next card on a timer until the viewer
  // takes over by touching/scrolling the feed themselves.
  useEffect(() => {
    if (paused || cards.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % cards.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [paused, cards.length]);

  useEffect(() => {
    const card = containerRef.current?.children[index] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [index]);

  if (cards.length === 0) {
    return (
      <p className="flex h-[calc(100dvh-8rem)] items-center justify-center px-6 text-center text-[13px] text-text-muted">
        No shorts yet — check back soon.
      </p>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        onPointerDown={() => setPaused(true)}
        onScroll={(event) => {
          const el = event.currentTarget;
          const nearest = Math.round(el.scrollTop / el.clientHeight);
          if (nearest !== index) setIndex(nearest);
        }}
        className="h-[calc(100dvh-8rem)] snap-y snap-mandatory overflow-y-scroll rounded-2xl bg-black"
      >
        {cards.map((card) =>
          card.kind === "advert" ? (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                setOpenAdvert(card);
                recordAdvertOpened();
              }}
              className="relative flex h-[calc(100dvh-8rem)] w-full snap-start items-end justify-center overflow-hidden text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- same arbitrary-origin convention as the listing branch below */}
              <img src={card.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute left-4 top-4 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Sponsored
              </span>
              <div className="relative z-10 w-full bg-gradient-to-t from-black/85 via-black/20 to-transparent p-5 pb-6 text-white">
                <p className="text-[11px] uppercase tracking-wide text-white/70">{card.sponsorName}</p>
                <p className="font-display text-[18px] font-bold leading-tight">{card.tagline}</p>
              </div>
            </button>
          ) : (
            <Link
              key={card.id}
              href={`/listing/${card.id}`}
              className="relative flex h-[calc(100dvh-8rem)] w-full snap-start items-end justify-center overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary provider/scraper origins, same convention as listing/[id] */}
              <img src={card.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="relative z-10 w-full bg-gradient-to-t from-black/85 via-black/20 to-transparent p-5 pb-6 text-white">
                <p className="text-[11px] uppercase tracking-wide text-white/70">{card.providerName}</p>
                <p className="font-display text-[18px] font-bold leading-tight">{card.name}</p>
                <p className="mt-1 text-[15px] font-semibold text-accent-teal">
                  {card.currency} {card.price}
                </p>
              </div>
            </Link>
          ),
        )}
      </div>

      {openAdvert && (
        <AdvertLightbox
          imageUrl={openAdvert.image}
          sponsorName={openAdvert.sponsorName}
          onClose={() => setOpenAdvert(null)}
        />
      )}
    </>
  );
}
