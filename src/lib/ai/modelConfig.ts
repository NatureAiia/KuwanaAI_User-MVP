import { prisma } from "@/lib/prisma";
import { AI_FEATURES, DEFAULT_MODELS, findModel, type AiFeature, type ModelSpec } from "./models";

const SETTING_PREFIX = "llm.model.";

function settingKey(feature: AiFeature) {
  return `${SETTING_PREFIX}${feature}`;
}

/**
 * Every model call needs to know which model to use, so an uncached read would
 * put a database round-trip in front of each one — on top of the model call
 * itself. The selection changes about as often as an admin clicks a button, so
 * a short TTL is the right trade.
 *
 * The cache is per-process, so on a multi-replica deploy a change takes up to
 * TTL to reach every replica. That is acceptable for a model swap (the old and
 * new models both work) in a way it would not be for, say, an auth decision.
 */
const CACHE_TTL_MS = 30_000;

let cache: { models: Record<AiFeature, string>; expiresAt: number } | null = null;

async function loadModels(): Promise<Record<AiFeature, string>> {
  const resolved = { ...DEFAULT_MODELS };
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: AI_FEATURES.map(settingKey) } },
  });
  for (const row of rows) {
    const feature = row.key.slice(SETTING_PREFIX.length) as AiFeature;
    // Guard against a stored id that has since left the catalog — falling back
    // to the default keeps the feature working instead of failing every call
    // with "unknown model" until someone notices.
    if (feature in resolved && findModel(row.value)) resolved[feature] = row.value;
  }
  return resolved;
}

export async function getSelectedModels(): Promise<Record<AiFeature, string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.models;
  try {
    const models = await loadModels();
    cache = { models, expiresAt: Date.now() + CACHE_TTL_MS };
    return models;
  } catch (err) {
    // A database blip must not take the AI features down with it. Serve the
    // stale entry if we have one, defaults if we don't.
    console.error("[ai] could not read model settings, using defaults:", err);
    return cache?.models ?? { ...DEFAULT_MODELS };
  }
}

export async function resolveModel(feature: AiFeature): Promise<ModelSpec> {
  const models = await getSelectedModels();
  return findModel(models[feature]) ?? findModel(DEFAULT_MODELS[feature])!;
}

export async function setSelectedModel(params: {
  feature: AiFeature;
  modelId: string;
  updatedBy: string;
}): Promise<void> {
  if (!findModel(params.modelId)) throw new Error(`Unknown model: ${params.modelId}`);
  await prisma.appSetting.upsert({
    where: { key: settingKey(params.feature) },
    create: { key: settingKey(params.feature), value: params.modelId, updatedBy: params.updatedBy },
    update: { value: params.modelId, updatedBy: params.updatedBy },
  });
  cache = null;
}
