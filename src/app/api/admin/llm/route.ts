import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { setSelectedModel, getSelectedModels } from "@/lib/ai/modelConfig";
import { findModel, isAiFeature } from "@/lib/ai/models";
import { privateJson } from "@/lib/apiResponse";

const bodySchema = z.object({
  feature: z.string().refine(isAiFeature, "Unknown feature"),
  modelId: z.string().min(1),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { feature, modelId } = parsed.data;

  const model = findModel(modelId);
  if (!model) return NextResponse.json({ error: "Unknown model" }, { status: 400 });

  const previous = (await getSelectedModels())[feature];
  await setSelectedModel({ feature, modelId, updatedBy: admin.email });

  // A model swap changes what every user of that feature is served and what it
  // costs, so it belongs in the same audit trail as a role change.
  await logAdminAction({
    adminEmail: admin.email,
    action: "llm_model_changed",
    targetType: "setting",
    targetId: `llm.model.${feature}`,
    detail: `${feature}: ${previous} → ${modelId}`,
  });

  return privateJson({ feature, modelId });
}
