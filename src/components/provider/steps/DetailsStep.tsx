"use client";

import { clsx } from "clsx";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { ImageGalleryField } from "@/components/provider/ImageGalleryField";
import { Button } from "@/components/ui/Button";

export function DetailsStep({
  name,
  onNameChange,
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
  price: string;
  onPriceChange: (v: string) => void;
  currency: CurrencyCode;
  onCurrencyChange: (v: CurrencyCode) => void;
  images: string[];
  onImagesChange: (v: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const canContinue = name.trim().length > 0 && Number(price) > 0;

  return (
    <div>
      <p className="font-display text-[16px] font-semibold">Details & photos</p>

      <label className="mt-4 block text-[12.5px] font-medium text-text-secondary">Name</label>
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="e.g. Prepaid Data Bundle — 5GB"
        className="tap-target mt-1.5 w-full rounded-xl border border-border bg-bg-surface-raised px-4 py-3 text-[14px] outline-none focus:border-accent-sky"
      />

      <label className="mt-4 block text-[12.5px] font-medium text-text-secondary">Price</label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <input
          inputMode="decimal"
          value={price}
          onChange={(e) => onPriceChange(e.target.value.replace(/[^0-9.]/g, ""))}
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
