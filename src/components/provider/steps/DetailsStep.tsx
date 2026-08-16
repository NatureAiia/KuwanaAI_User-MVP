"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { ImageGalleryField } from "@/components/provider/ImageGalleryField";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";

export function DetailsStep({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  price,
  onPriceChange,
  currency,
  onCurrencyChange,
  images,
  onImagesChange,
  onNext,
  onBack,
}: {
  name: string;
  onNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  price: string;
  onPriceChange: (v: string) => void;
  currency: CurrencyCode;
  onCurrencyChange: (v: CurrencyCode) => void;
  images: string[];
  onImagesChange: (v: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [nameTouched, setNameTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);
  const nameValid = name.trim().length > 0;
  const priceValid = Number(price) > 0;
  const canContinue = nameValid && priceValid;
  const nameError = nameTouched && !nameValid ? "Enter a name for this listing" : null;
  const priceError = priceTouched && !priceValid ? "Enter a price greater than 0" : null;

  return (
    <div>
      <p className="font-display text-[16px] font-semibold">Details & photos</p>

      <label className="mt-4 block text-[12.5px] font-medium text-text-secondary">Name</label>
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onBlur={() => setNameTouched(true)}
        placeholder="e.g. Prepaid Data Bundle — 5GB"
        className="tap-target mt-1.5 w-full rounded-xl border border-border bg-bg-surface-raised px-4 py-3 text-[14px] outline-none focus:border-accent-sky"
      />
      <FieldError error={nameError} />

      <label className="mt-4 block text-[12.5px] font-medium text-text-secondary">
        Description <span className="font-normal text-text-muted">(optional)</span>
      </label>
      <textarea
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="What makes this worth buying — coverage, materials, what's included…"
        rows={4}
        maxLength={2000}
        className="tap-target mt-1.5 w-full resize-none rounded-xl border border-border bg-bg-surface-raised px-4 py-3 text-[14px] outline-none focus:border-accent-sky"
      />

      <label className="mt-4 block text-[12.5px] font-medium text-text-secondary">Price</label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          inputMode="decimal"
          value={price}
          onChange={(e) => onPriceChange(e.target.value.replace(/[^0-9.]/g, ""))}
          onBlur={() => setPriceTouched(true)}
          placeholder="0.00"
          className="tap-target w-28 rounded-xl border border-border bg-bg-surface-raised px-3 py-3 text-center font-mono text-[16px] outline-none focus:border-accent-sky"
        />
        <div className="flex flex-wrap gap-1.5">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => onCurrencyChange(c.code)}
              className={clsx(
                "tap-target rounded-full border px-3 py-1.5 text-[12.5px] font-semibold",
                currency === c.code
                  ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                  : "border-border text-text-secondary",
              )}
            >
              {c.flag} {c.code}
            </button>
          ))}
        </div>
      </div>
      <FieldError error={priceError} />

      <label className="mt-5 block text-[12.5px] font-medium text-text-secondary">Photos</label>
      <div className="mt-1.5">
        <ImageGalleryField images={images} onChange={onImagesChange} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onNext} disabled={!canContinue}>
          Next
        </Button>
      </div>
    </div>
  );
}
