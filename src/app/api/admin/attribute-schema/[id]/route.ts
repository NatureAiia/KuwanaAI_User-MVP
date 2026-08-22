import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { privateJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/adminAudit";
import { revalidateCatalog } from "@/lib/cacheTags";

const bodySchema = z.object({ isComparable: z.boolean() });

/**
 * Admin's final visibility gate on one AttributeSchemaField — the last step
 * in the dynamic-field lifecycle (corporate proposes -> regulator approves
 * -> admin approves, creating the field with isComparable:false -> admin
 * flips it here once ready for consumer comparisons). Also usable on any
 * existing field, not just new_field-originated ones.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  const field = await prisma.attributeSchemaField.update({
    where: { id },
    data: { isComparable: parsed.data.isComparable },
  });

  await logAdminAction({
    adminEmail: admin.email,
    action: "attribute_field_visibility_changed",
    targetType: "attribute_schema_field",
    targetId: id,
    detail: `Set "${field.label}" (${field.key}) isComparable=${parsed.data.isComparable}`,
  });

  revalidateCatalog();
  return privateJson({ field });
}
