"use client";

import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; r: number; dx: number; dy: number; twinkle: number };
type Trail = { x: number; y: number; r: number; life: number; dx: number; dy: number };

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16) || 0x2dd4bf;
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

/**
 * Ambient canvas layer for the hero: sine-wave background lines, a drifting
 * particle field with proximity links, a cursor-trailing spotlight, and a
 * proximity glow on any descendant marked `data-scan`. Confined to the
 * `containerId` element's bounds (not the full page) so it stays a hero
 * effect rather than running behind content the user has scrolled past.
 */
export function LandingFX({ containerId }: { containerId: string }) {
  const linesRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<HTMLCanvasElement | null>(null);
  const trailRef = useRef<HTMLCanvasElement | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = document.getElementById(containerId);
    const linesCanvas = linesRef.current;
    const particlesCanvas = particlesRef.current;
    const trailCanvas = trailRef.current;
    const spotlight = spotlightRef.current;
    if (!container || !linesCanvas || !particlesCanvas || !trailCanvas || !spotlight) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const linesCtx = linesCanvas.getContext("2d");
    const particlesCtx = particlesCanvas.getContext("2d");
    const trailCtx = trailCanvas.getContext("2d");
    if (!linesCtx || !particlesCtx || !trailCtx) return;

    const rgb = hexToRgb(
      getComputedStyle(document.documentElement).getPropertyValue("--accent-teal") || "#2dd4bf",
    );
    spotlight.style.background = `radial-gradient(circle, rgba(${rgb}, 0.18), transparent 70%)`;

    let frameId = 0;
    let width = 0;
    let height = 0;
    let time = 0;
    let mouseX = 0;
    let mouseY = 0;
    let lightX = 0;
    let lightY = 0;
    let particles: Particle[] = [];
    let trails: Trail[] = [];
    const scanTargets = Array.from(container.querySelectorAll<HTMLElement>("[data-scan]"));

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      for (const c of [linesCanvas, particlesCanvas, trailCanvas]) {
        c.width = width;
        c.height = height;
      }
      const count = Math.max(24, Math.round((width * height) / 16000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.8 + Math.random() * 1.6,
        dx: (Math.random() - 0.5) * 0.14,
        dy: (Math.random() - 0.5) * 0.14,
        twinkle: Math.random() * Math.PI * 2,
      }));
      mouseX = width / 2;
      mouseY = height * 0.4;
      lightX = mouseX;
      lightY = mouseY;
    };

    const drawLines = () => {
      linesCtx.clearRect(0, 0, width, height);
      const lineCount = 4;
      for (let i = 0; i < lineCount; i += 1) {
        linesCtx.beginPath();
        const amp = 16 + i * 5;
        const baseY = height - 50 + i * 12;
        const speed = 0.3 + i * 0.05;
        for (let x = 0; x <= width; x += 14) {
          const y =
            baseY +
            Math.sin(x * 0.006 + time * speed + i) * amp * 0.4 +
            Math.sin(x * 0.002 - time * speed * 0.5) * amp * 0.6;
          if (x === 0) linesCtx.moveTo(x, y);
          else linesCtx.lineTo(x, y);
        }
        linesCtx.strokeStyle = `rgba(${rgb}, ${0.05 + (lineCount - i) * 0.02})`;
        linesCtx.lineWidth = 1;
        linesCtx.stroke();
      }
      time += 0.01;
    };

    const spawnTrail = (x: number, y: number) => {
      trails.push({
        x,
        y,
        r: 1.6 + Math.random() * 2.2,
        life: 1,
        dx: (Math.random() - 0.5) * 0.5,
        dy: (Math.random() - 0.5) * 0.5,
      });
      if (trails.length > 80) trails.shift();
    };

    const drawParticles = () => {
      particlesCtx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        p.twinkle += 0.02;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        const flicker = 0.25 + Math.sin(p.twinkle) * 0.18;
        particlesCtx.beginPath();
        particlesCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        particlesCtx.fillStyle = `rgba(${rgb}, ${flicker.toFixed(3)})`;
        particlesCtx.fill();
      }
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 120) {
            particlesCtx.beginPath();
            particlesCtx.moveTo(a.x, a.y);
            particlesCtx.lineTo(b.x, b.y);
            particlesCtx.strokeStyle = `rgba(${rgb}, ${((1 - dist / 120) * 0.08).toFixed(3)})`;
            particlesCtx.lineWidth = 1;
            particlesCtx.stroke();
          }
        }
      }
    };

    const drawTrail = () => {
      trailCtx.clearRect(0, 0, width, height);
      for (const p of trails) {
        p.x += p.dx;
        p.y += p.dy;
        p.life -= 0.025;
        trailCtx.beginPath();
        trailCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        trailCtx.fillStyle = `rgba(${rgb}, ${Math.max(0, p.life * 0.25).toFixed(3)})`;
        trailCtx.fill();
      }
      trails = trails.filter((p) => p.life > 0);
    };

    const updateIgnition = () => {
      const containerRect = container.getBoundingClientRect();
      const viewportX = lightX + containerRect.left;
      const viewportY = lightY + containerRect.top;
      for (const el of scanTargets) {
        const rect = el.getBoundingClientRect();
        const cx = Math.max(rect.left, Math.min(viewportX, rect.right));
        const cy = Math.max(rect.top, Math.min(viewportY, rect.bottom));
        const dist = Math.hypot(viewportX - cx, viewportY - cy);
        const strength = Math.max(0, 1 - dist / 220);
        el.style.boxShadow =
          strength > 0 ? `0 0 ${10 + strength * 26}px rgba(${rgb}, ${(0.2 * strength).toFixed(3)})` : "";
      }
    };

    const loop = () => {
      lightX += (mouseX - lightX) * 0.16;
      lightY += (mouseY - lightY) * 0.16;
      spotlight.style.transform = `translate3d(${lightX}px, ${lightY}px, 0)`;
      spotlight.style.opacity = "1";
      drawLines();
      drawParticles();
      drawTrail();
      updateIgnition();
      frameId = window.requestAnimationFrame(loop);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX = event.clientX - rect.left;
      mouseY = event.clientY - rect.top;
      spawnTrail(mouseX, mouseY);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    container.addEventListener("pointermove", onPointerMove);
    loop();

    return () => {
      window.cancelAnimationFrame(frameId);
      container.removeEventListener("pointermove", onPointerMove);
      ro.disconnect();
    };
  }, [containerId]);

  return (
    <>
      <canvas ref={linesRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
      <canvas ref={particlesRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
      <canvas ref={trailRef} className="pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        ref={spotlightRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 blur-3xl"
      />
    </>
  );
}
