"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { clsx } from "clsx";
import { CategoryStep } from "@/components/provider/steps/CategoryStep";
import { DetailsStep } from "@/components/provider/steps/DetailsStep";
import { SpecsStep } from "@/components/provider/steps/SpecsStep";
import { ReviewStep } from "@/components/provider/steps/ReviewStep";
import type { CategoryOption, ExistingListing } from "@/components/provider/types";
import type { CurrencyCode } from "@/lib/currency";

export type { AttributeField, CategoryOption, ExistingListing } from "@/components/provider/types";

const STEPS = ["category", "details", "specs", "review"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABELS: Record<Step, string> = {
  category: "Category",
  details: "Details & Photos",
  specs: "Specs",
  review: "Review",
};

export function ProviderListingForm({
  mode,
  categories,
  listing,
}: {
  mode: "create" | "edit";
  categories: CategoryOption[];
  listing?: ExistingListing;
}) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [furthestStep, setFurthestStep] = useState(mode === "edit" ? STEPS.length - 1 : 0);
  const [categoryId, setCategoryId] = useState<string | null>(listing?.categoryId ?? null);
  const [name, setName] = useState(listing?.name ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [price, setPrice] = useState(listing ? String(listing.price) : "");
  const [currency, setCurrency] = useState<CurrencyCode>((listing?.currency as CurrencyCode) ?? "USD");
  const [images, setImages] = useState<string[]>(listing?.images ?? []);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (listing) for (const [k, v] of Object.entries(listing.attributes)) initial[k] = String(v);
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"draft" | "pending_review" | null>(null);

  const category = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);

  function goTo(index: number) {
    setError(null);
    setStepIndex(index);
    setFurthestStep((f) => Math.max(f, index));
  }
  function goNext() {
    goTo(Math.min(stepIndex + 1, STEPS.length - 1));
  }
  function goBack() {
    goTo(Math.max(stepIndex - 1, 0));
  }

  async function submit(status: "draft" | "pending_review") {
    if (!categoryId || !name.trim() || !(Number(price) > 0)) {
      setError("Please fill in every step before submitting.");
      return;
    }
    setError(null);
    setLoading(status);
    try {
      const attributes: Record<string, unknown> = {};
      for (const field of category?.attributeSchema ?? []) {
        const raw = attributeValues[field.key];
        if (raw === undefined || raw === "") continue;
        attributes[field.key] =
          field.dataType === "number" ? Number(raw) : field.dataType === "boolean" ? raw === "yes" : raw;
      }

      const trimmedDescription = description.trim() || null;
      const body =
        mode === "create"
          ? {
              categoryId,
              name,
              description: trimmedDescription ?? undefined,
              price: Number(price),
              currency,
              attributes,
              images,
              status,
            }
          : { name, description: trimmedDescription, price: Number(price), currency, attributes, images, status };

      const res = await fetch(
        mode === "create" ? "/api/provider/listings" : `/api/provider/listings/${listing!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Something went wrong — please try again.");
        return;
      }
      router.push("/provider");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const step = STEPS[stepIndex];

  return (
    <div className="mx-auto max-w-[640px]">
      <button
        type="button"
        onClick={() => router.push("/provider")}
        className="tap-target -ml-2 mb-3 flex items-center gap-1 text-[13px] font-medium text-text-secondary"
      >
        <ArrowLeft size={16} /> Back to products
      </button>

      <div className="mb-6 flex items-center gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => i <= furthestStep && goTo(i)}
            disabled={i > furthestStep}
            className={clsx(
              "flex flex-1 flex-col items-center gap-1.5 border-b-2 pb-2 text-[11px] font-semibold uppercase tracking-wide",
              i === stepIndex
                ? "border-accent-sky text-accent-sky"
                : i <= furthestStep
                  ? "border-border text-text-secondary"
                  : "border-border/50 text-text-muted",
            )}
          >
            <span
              className={clsx(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                i === stepIndex
                  ? "bg-accent-sky text-[var(--text-on-accent-sky)]"
                  : i < furthestStep
                    ? "bg-accent-teal text-[#0b1512]"
                    : "bg-bg-surface-raised",
              )}
            >
              {i < furthestStep ? <Check size={11} /> : i + 1}
            </span>
            <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
          </button>
        ))}
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
        {step === "category" && (
          <CategoryStep
            categories={categories}
            categoryId={categoryId}
            locked={mode === "edit"}
            onSelect={(id) => {
              setCategoryId(id);
              goNext();
            }}
          />
        )}
        {step === "details" && (
          <DetailsStep
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            price={price}
            onPriceChange={setPrice}
            currency={currency}
            onCurrencyChange={setCurrency}
            images={images}
            onImagesChange={setImages}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {step === "specs" && (
          <SpecsStep
            fields={category?.attributeSchema ?? []}
            values={attributeValues}
            onChange={(key, value) => setAttributeValues((prev) => ({ ...prev, [key]: value }))}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {step === "review" && (
          <ReviewStep
            name={name}
            description={description}
            price={price}
            currency={currency}
            images={images}
            attributeFields={category?.attributeSchema ?? []}
            attributeValues={attributeValues}
            currentStatus={listing?.status}
            rejectionReason={listing?.rejectionReason ?? null}
            error={error}
            loading={loading}
            onBack={goBack}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  );
}
