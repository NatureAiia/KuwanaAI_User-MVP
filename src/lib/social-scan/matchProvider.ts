import { NETWORKS, BANKS, INSURERS, MEDICAL_AIDS } from "@/lib/onboarding-options";

const SKIP_SENTINELS = new Set(["I don't bank", "I don't have insurance", "None", "Public hospital only"]);

const KNOWN_PROVIDERS = [...NETWORKS, ...BANKS, ...INSURERS, ...MEDICAL_AIDS].filter(
  (name) => !SKIP_SENTINELS.has(name),
);

/** Matches a known Kuwana-tracked provider name against free text, case-insensitively. */
export function matchProvider(text: string): string | null {
  const lower = text.toLowerCase();
  for (const provider of KNOWN_PROVIDERS) {
    if (lower.includes(provider.toLowerCase())) return provider;
  }
  return null;
}
