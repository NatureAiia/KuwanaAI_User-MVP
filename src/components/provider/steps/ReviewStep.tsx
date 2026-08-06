"use client";

import Image from "next/image";
import { Save, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import type { AttributeField } from "@/components/provider/types";

export function ReviewStep({
  name,
  description,
  price,
  currency,
  images,
  attributeFields,
  attributeValues,
  currentStatus,
  rejectionReason,
  error,
  loading,
  onBack,
  onSubmit,
}: {
  name: string;
  description: string;
  price: string;
  currency: CurrencyCode;
  images: string[];
  attributeFields: AttributeField[];
  attributeValues: Record<string, string>;
  currentStatus?: "draft" | "pending_review" | "published" | "rejected";
  rejectionReason: string | null;
  error: string | null;
  loading: "draft" | "pending_review" | null;
  onBack: () => void;
  onSubmit: (status: "draft" | "pending_review") => void;
}) {
  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? "";

  return (
    <div>
      <p className="font-display text-[16px] font-semibold">Ready to send?</p>

      {currentStatus === "rejected" && rejectionReason && (
        <p className="mt-3 rounded-xl border border-accent-coral/30 bg-accent-coral/10 p-3 text-[12.5px] text-accent-coral">
          Rejected: {rejectionReason}
        </p>
      )}
      {currentStatus === "published" && (
        <p className="mt-3 rounded-xl border border-border bg-bg-surface-raised p-3 text-[12.5px] text-text-secondary">
          This product is live. Saving takes it off the public catalog until an admin re-approves it.
        </p>
      )}

      <div className="mt-4 flex gap-3 rounded-2xl border border-border bg-bg-surface-raised p-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-bg-surface">
          {images[0] && <Image src={images[0]} alt="" width={64} height={64} className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-[13.5px]">
          <p className="truncate font-semibold">{name || "Untitled"}</p>
          <p className="font-mono">
            {symbol}
            {price || "0.00"} {currency}
          </p>
          {description && <p className="line-clamp-2 text-text-secondary">{description}</p>}
          {attributeFields.map((f) => {
            const v = attributeValues[f.key];
            if (!v) return null;
            return (
              <p key={f.key} className="text-text-secondary">
                <span className="text-text-muted">{f.label}: </span>
                {f.dataType === "boolean" ? (v === "yes" ? "Yes" : "No") : v}
                {f.unit && f.dataType === "number" ? ` ${f.unit}` : ""}
              </p>
            );
          })}
        </div>
      </div>

      {error && <p className="mt-3 text-[13px] text-accent-coral">{error}</p>}

      <div className="mt-5 flex flex-col gap-2.5">
        <Button type="button" onClick={() => onSubmit("pending_review")} disabled={loading !== null} className="gap-2">
          <Send size={15} /> {loading === "pending_review" ? "Sending…" : "Send for review"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onSubmit("draft")}
          disabled={loading !== null}
          className="gap-2"
        >
          <Save size={14} /> {loading === "draft" ? "Saving…" : "Save as draft"}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
