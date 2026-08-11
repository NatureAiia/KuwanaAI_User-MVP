import { NextResponse } from "next/server";
import { GENERIC_FACTS } from "@/lib/onboarding-facts";

// Facts endpoint for the loading screens. Serves a randomized mix of Kuwana's
// on-device fact bank and a couple of fresh facts pulled from the internet so
// the loading screen stays varied without depending on an external API key.
//
// The internet source (Useless Facts) is free and keyless; results are cached
// in process memory and only refreshed every REFRESH_MS so we don't hammer it.

const INTERNET_FACTS_URL = "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en";
const REFRESH_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4000;
const FACTS_PER_RESPONSE = 8;

let cache: { facts: string[]; fetchedAt: number } | null = null;

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchInternetFacts(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(INTERNET_FACTS_URL, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = (await res.json()) as { text?: unknown };
    return typeof json.text === "string" && json.text.trim() ? [json.text.trim()] : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const now = Date.now();
  if (!cache || now - cache.fetchedAt > REFRESH_MS) {
    const [internetA, internetB] = await Promise.all([
      fetchInternetFacts(),
      fetchInternetFacts(),
    ]);
    cache = { facts: [...internetA, ...internetB], fetchedAt: now };
  }

  const pool = shuffle([...GENERIC_FACTS, ...cache.facts]);
  return NextResponse.json({ facts: pool.slice(0, FACTS_PER_RESPONSE) });
}
