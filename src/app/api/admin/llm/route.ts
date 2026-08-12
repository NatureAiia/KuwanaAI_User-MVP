import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { getLadders, setLadder } from "@/lib/ai/modelConfig";
import { isAiFeature } from "@/lib/ai/models";
import { privateJson } from "@/lib/apiResponse";

const bodySchema = z.object({
  feature: z.string().refine(isAiFeature, "Unknown feature"),
  // Ordered cheapest-first. Order is the whole meaning of the value, so it is
  // stored and validated as a list rather than a set.
  ladder: z.array(z.string().min(1)).min(1).max(6),
});

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { feature, ladder } = parsed.data;

  const previous = (await getLadders())[feature];

  try {
    await setLadder({ feature, ladder, updatedBy: admin.email });
  } catch (err) {
    // setLadder rejects unknown or duplicated models — a caller error, not a
    // server fault, so it should not surface as a 500.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid ladder" },
      { status: 400 },
    );
  }

  // A ladder change alters which model every user of that feature is served
  // and what it costs, so it belongs in the same audit trail as a role change.
  await logAdminAction({
    adminEmail: admin.email,
    action: "llm_model_changed",
    targetType: "setting",
    targetId: `llm.tier.${feature}`,
    detail: `${feature}: [${previous.join(" → ")}] → [${ladder.join(" → ")}]`,
  });

  return privateJson({ feature, ladder });
}
