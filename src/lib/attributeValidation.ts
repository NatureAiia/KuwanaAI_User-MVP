import { prisma } from "@/lib/prisma";

/**
 * Cross-checks a listing's attribute values against its category's declared
 * attribute schema before they're persisted. Listing attributes are stored in
 * an untyped Json column and validated on the way in only as
 * `z.record(string, z.unknown())` — nothing previously stopped a value's
 * actual JS type from silently drifting from what its schema (and every
 * renderer/scoring engine) assumes it is, e.g. a boolean field saved as the
 * string `"true"` instead of the primitive `true`.
 */
export async function validateListingAttributes(
  categoryId: string,
  attributes: Record<string, unknown> | undefined,
): Promise<string | null> {
  if (!attributes) return null;

  const schema = await prisma.attributeSchemaField.findMany({
    where: { categoryId },
    select: { key: true, label: true, dataType: true },
  });
  const schemaByKey = new Map(schema.map((f) => [f.key, f]));

  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) continue; // clearing/omitting a field is fine

    const field = schemaByKey.get(key);
    if (!field) return `"${key}" isn't a recognized attribute for this category.`;

    const typeOk =
      (field.dataType === "number" && typeof value === "number" && Number.isFinite(value)) ||
      (field.dataType === "boolean" && typeof value === "boolean") ||
      ((field.dataType === "string" || field.dataType === "enum") && typeof value === "string");
    if (!typeOk) {
      const expected = field.dataType === "enum" ? "string" : field.dataType;
      return `"${field.label}" must be a ${expected}.`;
    }
  }
  return null;
}
