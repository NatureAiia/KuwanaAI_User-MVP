"use client";

// Full-screen loading experience shared by the post-login dashboard load and
// the signup "saving your profile" step: a Gallery Tunnel running behind
// rotating fun facts fetched from /api/facts (randomized, internet-refreshed).
// The tunnel background, grid lines, and text adapt to the active theme, and
// prefers-reduced-motion swaps the tunnel for a static backdrop.

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { GalleryTunnel } from "./GalleryTunnel";
import Text3DFlip from "@/components/ui/Text3DFlip";

const ROTATE_MS = 2600;

// Mirror the design tokens in src/app/globals.css so the tunnel matches the
// theme even though it renders on a plain <canvas>.
const THEME = {
  light: {
    background: "#f8fafc",
    lineColor: "#334155",
    backdrop: "radial-gradient(ellipse at center, #e2e8f0 0%, #f8fafc 75%)",
  },
  dark: {
    background: "#0f172a",
    lineColor: "#94a3b8",
    backdrop: "radial-gradient(ellipse at center, #1e293b 0%, #0f172a 75%)",
  },
} as const;

interface LoadingFactsProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function LoadingFacts({
  title = "Just a moment…",
  subtitle = "Loading your experience",
  children,
}: LoadingFactsProps) {
  const reduceMotion = useReducedMotion();
  const [isDark, setIsDark] = useState(false);
  const [facts, setFacts] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/facts", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { facts?: unknown } | null) => {
        if (cancelled) return;
        const list = Array.isArray(data?.facts)
          ? data.facts.filter((f): f is string => typeof f === "string")
          : [];
        setFacts(list);
      })
      .catch(() => {
        if (!cancelled) setFacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (facts.length === 0) return;
    timerRef.current = window.setInterval(() => {
      setIndex((i) => {
        const next = Math.floor(Math.random() * facts.length);
        return next === i ? (i + 1) % facts.length : next;
      });
    }, ROTATE_MS);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [facts]);

  const theme = isDark ? THEME.dark : THEME.light;
  const fact = facts.length > 0 ? facts[index % facts.length] : null;

  return (
    <div
      className="fixed inset-0 z-40 overflow-hidden"
      style={{ background: theme.background }}
    >
      {reduceMotion ? (
        <div className="absolute inset-0" style={{ background: theme.backdrop }} />
      ) : (
        <div className="absolute inset-0">
          <GalleryTunnel
            label={false}
            speed={70}
            fade={85}
            background={theme.background}
            lineColor={theme.lineColor}
          />
        </div>
      )}

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
        <div className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
          <Text3DFlip
            text="kuwana.ai"
            tag="span"
            animation="enter"
            intervalMs={8000}
            color="var(--accent-teal)"
            font={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 700,
              lineHeight: "1em",
              letterSpacing: "-0.025em",
              textAlign: "center",
            }}
            style={{ width: "auto", height: "auto", display: "inline-flex" }}
          />
        </div>
        <h1 className="mt-3 font-display text-[32px] font-bold leading-tight text-accent-teal drop-shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
          {title}
        </h1>
        <p
          className="mt-1 text-[12px] font-medium uppercase tracking-wide text-text-muted"
          aria-hidden="true"
        >
          {subtitle}
        </p>
        {fact && (
          <p
            key={fact}
            className="mt-6 max-w-[48ch] text-[14px] leading-relaxed text-text-primary drop-shadow-[0_1px_4px_rgba(0,0,0,0.2)]"
          >
            {fact}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
