import { existsSync } from "node:fs";
import { chromium } from "playwright";
import type { ScrapedPage } from "@/lib/scrape/firecrawl";

/**
 * Fallback fetch engine for the scrape pipeline (see ingest.ts) — used when
 * Firecrawl isn't configured (FirecrawlNotConfiguredError, e.g. no
 * self-hosted instance running) or its request fails, and for JS-rendered
 * pages a plain fetch can't handle at all. Browser-automation, not an API
 * call: heavier per-request, so it's the fallback, never the primary path.
 *
 * Uses Chromium directly rather than @playwright/test — this is a one-shot
 * fetch, not a test run, and pulling in the test runner for it would be the
 * wrong tool. In this deployment's dev/CI environment, Chromium resolves via
 * PLAYWRIGHT_BROWSERS_PATH; a production environment without that pre-seeded
 * cache needs `npx playwright install chromium` once at build/deploy time.
 *
 * Text extraction, not true markdown: innerText gives every LLM-based
 * downstream consumer (extractListingCandidate) real page content without
 * pulling in an HTML-to-markdown dependency for a fallback path — good
 * enough for extraction, which reads prose/numbers, not for display.
 */
// Pins to this deployment's pre-installed Chromium build rather than the
// version this project's `playwright` package would otherwise try to
// download on its own — keeps this working in an environment (like this
// one) where browser binaries are pre-seeded at a fixed path and outbound
// downloads during build/start aren't available. Harmless to leave set in
// any other environment that also has this path; falls through to
// Playwright's own resolution when it doesn't exist.
const PINNED_CHROMIUM_PATH = "/opt/pw-browsers/chromium";

export async function scrapeUrlWithPlaywright(url: string): Promise<ScrapedPage> {
  const executablePath = existsSync(PINNED_CHROMIUM_PATH) ? PINNED_CHROMIUM_PATH : undefined;
  // Chromium doesn't inherit HTTP(S)_PROXY from the environment the way
  // fetch()/curl do — pass it through explicitly wherever outbound traffic
  // is proxied (this environment's own agent proxy included), and simply
  // omit it wherever it isn't set.
  const proxyServer = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    proxy: proxyServer ? { server: proxyServer } : undefined,
  });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // A short settle for client-rendered content (SPA pricing pages, lazy-
    // loaded tables) — bounded, not a full networkidle wait, since some
    // pages never go fully idle (analytics beacons, polling widgets).
    await page.waitForTimeout(1500);

    const title = await page.title();
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    const finalUrl = page.url();

    return { markdown: text.trim(), url: finalUrl || url, title: title || null };
  } finally {
    await browser.close();
  }
}
