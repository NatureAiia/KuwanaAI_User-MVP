"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { clsx } from "clsx";
import { CategoryStep } from "@/components/provider/steps/CategoryStep";
import { DetailsStep } from "@/components/provider/steps/DetailsStep";
import { SpecsStep } from "@/components/provider/steps/SpecsStep";
import type { CategoryOption, ExistingListing } from "@/components/provider/types";
import type { CurrencyCode } from "@/lib/currency";
import { Button } from "@/components/ui/Button";

const STEPS = ["category", "details", "specs", "reason"] as const;
type Step = (typeof STEPS)[number];
const STEP_LABELS: Record<Step, string> = {
  category: "Category",
  details: "Details & Photos",
  specs: "Specs",
  reason: "Reason & Submit",
};

// Reuses the provider portal's step components (category/details/specs are
// identical concerns). mode="new_listing" POSTs a CorporateRequest for
// Kuwana to review (a never-before-seen product); mode="edit" PATCHes the
// listing directly and applies immediately — it's the business's own
// product, so no review hop, just a required reason that becomes the
// ListingUpdateLog entry shoppers' "last updated by" line is built from.
export function CorporateProductRequestForm({
  mode,
  categories,
  listing,
}: {
  mode: "new_listing" | "edit";
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
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function submit() {
    if (!categoryId || !name.trim() || !(Number(price) > 0)) {
      setError("Please fill in every step before submitting.");
      return;
    }
    if (!reason.trim()) {
      setError("Please explain why this change is being requested.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const attributes: Record<string, unknown> = {};
      for (const field of category?.attributeSchema ?? []) {
        const raw = attributeValues[field.key];
        if (raw === undefined || raw === "") continue;
        attributes[field.key] =
          field.dataType === "number" ? Number(raw) : field.dataType === "boolean" ? raw === "yes" : raw;
      }

      const res =
        mode === "edit"
          ? await fetch(`/api/corporate/listings/${listing!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                description: description.trim() || null,
                price: Number(price),
                currency,
                attributes,
                images,
                reason,
              }),
            })
          : await fetch("/api/corporate/requests", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "new_listing" as const,
                categoryId,
                proposedData: { name, description: description.trim() || null, price: Number(price), currency, attributes, images },
                reason,
              }),
            });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Something went wrong — please try again.");
        return;
      }
      router.push(mode === "edit" ? "/corporate/products" : "/corporate/requests");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const step = STEPS[stepIndex];

  return (
    <div className="mx-auto max-w-[640px]">
      <button
        type="button"
        onClick={() => router.push("/corporate/products")}
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
        {step === "reason" && (
          <div>
            <p className="font-display text-[16px] font-semibold">Why this change?</p>
            <p className="mt-1 text-[12.5px] text-text-secondary">
              {mode === "edit"
                ? "This applies immediately — it's your own product. The reason is kept as a record of why the data changed (e.g. correcting a scraper error, a rate change effective date)."
                : "This new product won't appear in the catalog until Kuwana reviews it."}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Q3 rate revision approved by treasury, effective 1 September"
              rows={4}
              maxLength={1000}
              className="tap-target mt-3 w-full resize-none rounded-xl border border-border bg-bg-surface-raised px-4 py-3 text-[14px] outline-none focus:border-accent-sky"
            />
            {error && <p className="mt-2 text-[13px] text-accent-coral">{error}</p>}
            <div className="mt-6 flex items-center justify-between">
              <Button type="button" variant="ghost" onClick={goBack}>
                Back
              </Button>
              <Button type="button" onClick={submit} disabled={loading}>
                {loading ? "Saving…" : mode === "edit" ? "Save changes" : "Submit request"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
