"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Clapperboard, ChevronDown, ChevronUp, Scale, Share2 } from "lucide-react";
import { AdvertLightbox } from "@/components/explore/AdvertLightbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProviderLogo } from "@/components/ProviderLogo";
import { Badge } from "@/components/ui/Card";
import { notifyGamification } from "@/lib/gamification/client";
import { TREND_ARROW, TREND_TONE, FRESHNESS_TONE } from "@/lib/listingDisplay";
import type { ShortsCard } from "@/lib/shortsTypes";

const AUTOPLAY_MS = 4000;

function recordAdvertOpened() {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType: "advert_opened" }),
  }).catch((err) => console.error("[shorts] failed to record advert open:", err));
}

/**
 * Right-side actions — deliberately not a TikTok-style like/comment rail:
 * this app's pitch is transparent comparisons, not social engagement, so
 * every action here does something real. Save persists via the same
 * /api/saved endpoint the compare page uses; Compare hands off to the
 * listing's category so the user can actually put it up against
 * alternatives; Share uses the real Web Share API.
 */
function ActionRail({
  card,
  saved,
  onToggleSave,
}: {
  card: ShortsCard;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const avatarName = card.kind === "listing" ? card.providerName : card.sponsorName;
  const avatarLogo = card.kind === "listing" ? card.providerLogoUrl : null;

  async function share() {
    const url = card.kind === "listing" ? `${location.origin}/listing/${card.id}` : location.href;
    if (navigator.share) {
      await navigator.share({ url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  return (
    <div className="absolute bottom-5 right-3 z-10 flex flex-col items-center gap-4">
      <ProviderLogo name={avatarName} logoUrl={avatarLogo} size={40} className="border-2 border-white/80" />

      {card.kind === "listing" && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggleSave();
            }}
            aria-label={saved ? "Remove from saved" : "Save this listing"}
            className="flex flex-col items-center gap-1 text-white"
          >
            <Bookmark size={26} className={saved ? "fill-accent-sky text-accent-sky" : "fill-black/20 text-white"} />
            <span className="text-[10.5px] font-semibold drop-shadow">Save</span>
          </button>

          <Link
            href={`/explore/${card.sectorSlug}`}
            aria-label={`Compare ${card.name} against alternatives`}
            className="flex flex-col items-center gap-1 text-white"
          >
            <Scale size={26} className="fill-black/20" />
            <span className="text-[10.5px] font-semibold drop-shadow">Compare</span>
          </Link>
        </>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          void share();
        }}
        aria-label="Share"
        className="flex flex-col items-center gap-1 text-white"
      >
        <Share2 size={24} className="fill-black/20" />
        <span className="text-[10.5px] font-semibold drop-shadow">Share</span>
      </button>
    </div>
  );
}

export function ShortsFeed({ cards, initialSavedIds = [] }: { cards: ShortsCard[]; initialSavedIds?: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [openAdvert, setOpenAdvert] = useState<Extract<ShortsCard, { kind: "advert" }> | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds));

  async function toggleSave(listingId: string) {
    const isSaved = savedIds.has(listingId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    const res = await fetch("/api/saved", {
      method: isSaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    }).catch(() => null);

    if (!res?.ok) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
      return;
    }

    if (!isSaved) {
      const data = await res.json().catch(() => null);
      notifyGamification(data?.gamification);
    }
  }

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

  function step(delta: number) {
    setPaused(true);
    setIndex((i) => Math.min(Math.max(i + delta, 0), cards.length - 1));
  }

  if (cards.length === 0) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black px-6">
        <EmptyState
          icon={Clapperboard}
          title="No shorts yet"
          description="Providers haven't posted any short clips or adverts yet — check back soon."
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <Link
        href="/dashboard"
        aria-label="Back"
        className="tap-target fixed left-4 top-10 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
      >
        <ArrowLeft size={18} />
      </Link>

      <div className="fixed right-4 top-4 z-20 hidden flex-col gap-2 md:flex">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={index === 0}
          aria-label="Previous"
          className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm disabled:opacity-30"
        >
          <ChevronUp size={18} />
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={index === cards.length - 1}
          aria-label="Next"
          className="tap-target flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm disabled:opacity-30"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      <div
        ref={containerRef}
        onPointerDown={() => setPaused(true)}
        onScroll={(event) => {
          const el = event.currentTarget;
          const nearest = Math.round(el.scrollTop / el.clientHeight);
          if (nearest !== index) setIndex(nearest);
        }}
        className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-scroll bg-black"
      >
        {cards.map((card) => (
          // A plain div per card, not itself a Link/button — the action
          // rail below renders buttons/links of its own, and an interactive
          // element can't nest inside another Link or button without
          // breaking HTML validity. The background image is the only
          // navigation/lightbox trigger; the rail and caption are siblings
          // layered on top of it.
          <div key={card.id} className="relative h-[100dvh] w-full snap-start overflow-hidden">
            {card.kind === "advert" ? (
              <button
                type="button"
                onClick={() => {
                  setOpenAdvert(card);
                  recordAdvertOpened();
                }}
                aria-label={`Open ${card.sponsorName} advert`}
                className="absolute inset-0 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- same arbitrary-origin convention as the listing branch below */}
                <img src={card.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute left-4 top-4 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Sponsored
                </span>
              </button>
            ) : (
              <>
                <Link href={`/listing/${card.id}`} aria-label={card.name} className="absolute inset-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary provider/scraper origins, same convention as listing/[id] */}
                  <img src={card.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                </Link>
                <div className="pointer-events-none absolute left-3 top-3 z-10 flex gap-1.5">
                  {card.priceTrend && card.priceTrend.direction !== "flat" && (
                    <Badge tone={TREND_TONE[card.priceTrend.direction]}>
                      {TREND_ARROW[card.priceTrend.direction]} {Math.abs(card.priceTrend.changePercent)}%
                    </Badge>
                  )}
                  <Badge tone={FRESHNESS_TONE[card.freshnessStatus]}>{card.freshnessStatus}</Badge>
                </div>
              </>
            )}

            <ActionRail card={card} saved={savedIds.has(card.id)} onToggleSave={() => toggleSave(card.id)} />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex w-full max-w-[calc(100%-4.5rem)] flex-col bg-gradient-to-t from-black/85 via-black/20 to-transparent p-5 pb-6 text-white">
              {card.kind === "advert" ? (
                <>
                  <p className="font-display text-[15px] font-bold leading-tight">{card.sponsorName}</p>
                  <p className="mt-1 text-[13.5px] leading-snug text-white/90">{card.tagline}</p>
                </>
              ) : (
                <>
                  <p className="font-display text-[15px] font-bold leading-tight">{card.providerName}</p>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-white/90">
                    {card.name} · {card.currency} {card.price}
                  </p>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {openAdvert && (
        <AdvertLightbox
          imageUrl={openAdvert.image}
          sponsorName={openAdvert.sponsorName}
          onClose={() => setOpenAdvert(null)}
        />
      )}
    </div>
  );
}
