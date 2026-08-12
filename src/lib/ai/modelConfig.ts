import { prisma } from "@/lib/prisma";
import { AI_FEATURES, findModel, type AiFeature } from "./models";
import { DEFAULT_TIERS } from "./tiers";

const SETTING_PREFIX = "llm.tier.";

function settingKey(feature: AiFeature) {
  return `${SETTING_PREFIX}${feature}`;
}

/**
 * Every model call needs the ladder, so an uncached read would put a database
 * round-trip in front of each one — on top of the model call itself. Ladders
 * change about as often as an admin clicks a button, so a short TTL is the
 * right trade.
 *
 * The cache is per-process, so on a multi-replica deploy a change takes up to
 * TTL to reach every replica. That is acceptable for a model swap (both the old
 * and new ladder work) in a way it would not be for an auth decision.
 */
const CACHE_TTL_MS = 30_000;

let cache: { ladders: Record<AiFeature, string[]>; expiresAt: number } | null = null;

/** Stored as JSON so the ordering — which *is* the tier ordering — survives. */
function parseLadder(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    // Drop ids that have since left the catalog rather than failing every call
    // with "unknown model" until someone notices.
    const known = parsed.filter((id): id is string => typeof id === "string" && !!findModel(id));
    return known.length > 0 ? known : null;
  } catch {
    return null;
  }
}

async function loadLadders(): Promise<Record<AiFeature, string[]>> {
  const resolved: Record<AiFeature, string[]> = { ...DEFAULT_TIERS };
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: AI_FEATURES.map(settingKey) } },
  });
  for (const row of rows) {
    const feature = row.key.slice(SETTING_PREFIX.length) as AiFeature;
    if (!(feature in resolved)) continue;
    const ladder = parseLadder(row.value);
    if (ladder) resolved[feature] = ladder;
  }
  return resolved;
}

export async function getLadders(): Promise<Record<AiFeature, string[]>> {
  if (cache && cache.expiresAt > Date.now()) return cache.ladders;
  try {
    const ladders = await loadLadders();
    cache = { ladders, expiresAt: Date.now() + CACHE_TTL_MS };
    return ladders;
  } catch (err) {
    // A database blip must not take the AI features down with it. Serve the
    // stale entry if we have one, defaults if we don't.
    console.error("[ai] could not read tier settings, using defaults:", err);
    return cache?.ladders ?? { ...DEFAULT_TIERS };
  }
}

export async function resolveLadder(feature: AiFeature): Promise<string[]> {
  return (await getLadders())[feature];
}

export async function setLadder(params: {
  feature: AiFeature;
  ladder: string[];
  updatedBy: string;
}): Promise<void> {
  if (params.ladder.length === 0) throw new Error("A ladder needs at least one model");
  const unknown = params.ladder.filter((id) => !findModel(id));
  if (unknown.length > 0) throw new Error(`Unknown model(s): ${unknown.join(", ")}`);
  // A duplicate rung would burn a retry on a model that just failed.
  if (new Set(params.ladder).size !== params.ladder.length) {
    throw new Error("A ladder cannot list the same model twice");
  }

  const value = JSON.stringify(params.ladder);
  await prisma.appSetting.upsert({
    where: { key: settingKey(params.feature) },
    create: { key: settingKey(params.feature), value, updatedBy: params.updatedBy },
    update: { value, updatedBy: params.updatedBy },
  });
  cache = null;
}
