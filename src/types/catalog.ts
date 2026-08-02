export type AttributeSchemaFieldDTO = {
  key: string;
  label: string;
  dataType: "number" | "string" | "enum" | "boolean";
  unit: string | null;
  isComparable: boolean;
  sortOrder: number;
};

export type ListingDTO = {
  id: string;
  name: string;
  price: number;
  currency: string;
  attributes: Record<string, unknown>;
  freshnessStatus: "fresh" | "stale" | "unverified";
  lastVerifiedAt: string;
  sourceUrl: string | null;
  provider: { id: string; name: string; logoUrl: string | null; verified: boolean };
};

export type CategoryDTO = {
  id: string;
  slug: string;
  name: string;
  attributeSchema: AttributeSchemaFieldDTO[];
};

export type CategoryWithListingsDTO = CategoryDTO & { listings: ListingDTO[] };
