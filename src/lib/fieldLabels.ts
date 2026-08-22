import type { AttributeSchemaFieldDTO } from "@/types/catalog";

/**
 * Resolves the display label for an attribute field depending on which
 * portal is rendering it — corporate surfaces always see the technical/
 * jargon `label` ("RTGS Fee") unchanged; consumer surfaces prefer the
 * plain-language `consumerLabel` ("Sending money fee") when the field has
 * one, falling back to `label` for fields that don't need translating
 * (Brand, Store, ...). Same underlying field either way — this is the
 * "link between corporate jargon and consumer slang" the two portals share.
 */
export function resolveFieldLabel(
  field: Pick<AttributeSchemaFieldDTO, "label" | "consumerLabel">,
  audience: "corporate" | "consumer",
): string {
  if (audience === "consumer" && field.consumerLabel) return field.consumerLabel;
  return field.label;
}
