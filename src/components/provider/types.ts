export type AttributeField = {
  key: string;
  label: string;
  dataType: "number" | "string" | "enum" | "boolean";
  unit: string | null;
};

export type CategoryOption = {
  id: string;
  name: string;
  sector: { slug: string; name: string };
  attributeSchema: AttributeField[];
};

export type ExistingListing = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  attributes: Record<string, unknown>;
  price: number;
  currency: string;
  images: string[];
  status: "draft" | "pending_review" | "published" | "rejected";
  rejectionReason: string | null;
};
