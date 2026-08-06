"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Save, Camera, Star, X, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { SECTORS, LIVE_SECTORS, type SectorSlug } from "@/lib/sectors";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, setCover, removeAt } from "@/components/provider/imageGallery";

type AttributeField = {
  key: string;
  label: string;
  dataType: "number" | "string" | "enum" | "boolean";
  unit: string | null;
};

type CategoryOption = {
  id: string;
  name: string;
  sector: { slug: string; name: string };
  attributeSchema: AttributeField[];
};

/**
 * A guided, one-question-per-screen submission flow — not a web form.
 * Built for a provider who may have no website, no social presence, and
 * limited reading comfort: one big decision per screen, plain everyday
 * words instead of field labels, large tap targets, and a single obvious
 * next action low on the screen (thumb reach), the way WhatsApp or EcoCash
 * ask one thing at a time rather than presenting a dense form. No JSON, no
 * dropdowns — every input is either a big button to tap or one thing to
 * type.
 */
export function NewProviderListingForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [sectorSlug, setSectorSlug] = useState<SectorSlug | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"draft" | "pending_review" | null>(null);
  const [done, setDone] = useState<"draft" | "pending_review" | null>(null);

  const sectorsWithCategories = useMemo(
    () => LIVE_SECTORS.filter((slug) => categories.some((c) => c.sector.slug === slug)),
    [categories],
  );
  const categoriesInSector = useMemo(
    () => categories.filter((c) => c.sector.slug === sectorSlug),
    [categories, sectorSlug],
  );
  const category = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);

  const screens = useMemo(
    () => ["sector", "category", "name", "price", ...(category?.attributeSchema.map((a) => `attr:${a.key}`) ?? []), "images", "review"],
    [category],
  );
  const screen = screens[stepIndex];

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, screens.length - 1));
  }
  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function submit(status: "draft" | "pending_review") {
    setError(null);
    setLoading(status);
    try {
      const attributes: Record<string, unknown> = {};
      for (const field of category?.attributeSchema ?? []) {
        const raw = attributeValues[field.key];
        if (raw === undefined || raw === "") continue;
        attributes[field.key] = field.dataType === "number" ? Number(raw) : field.dataType === "boolean" ? raw === "yes" : raw;
      }

      const res = await fetch("/api/provider/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, name, price: Number(price), currency, attributes, images, status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Something went wrong — please try again.");
        return;
      }
      setDone(status);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  function reset() {
    setStepIndex(0);
    setSectorSlug(null);
    setCategoryId(null);
    setName("");
    setPrice("");
    setCurrency("USD");
    setAttributeValues({});
    setImages([]);
    setImageError(null);
    setDone(null);
  }

  async function handleFileChosen(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || uploading || images.length >= MAX_IMAGES) return;
    setImageError(null);

    if (!ALLOWED_IMAGE_TYPES[file.type]) {
      setImageError("Only JPEG, PNG, or WebP images are allowed");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("Image must be 5MB or smaller");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/provider/listings/images", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.url !== "string") {
        setImageError(typeof data?.error === "string" ? data.error : "Upload failed — please try again.");
        return;
      }
      setImages((prev) => [...prev, data.url]);
    } finally {
      setUploading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-card)] border border-accent-teal/40 bg-accent-teal/5 p-6 text-center">
        <p className="font-display text-[17px] font-semibold">
          {done === "pending_review" ? "Sent for review! 🎉" : "Saved as a draft"}
        </p>
        <p className="mt-2 text-[13px] text-text-secondary">
          {done === "pending_review"
            ? "An admin will check it and make it live soon."
            : "You can come back and finish it any time."}
        </p>
        <button
          onClick={reset}
          className="tap-target mt-4 rounded-xl bg-accent-sky px-5 py-3 text-[14px] font-semibold text-[var(--text-on-accent-sky)]"
        >
          Add another
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-5">
      {stepIndex > 0 && (
        <button
          onClick={goBack}
          className="tap-target -ml-2 mb-3 flex items-center gap-1 text-[13px] font-medium text-text-secondary"
        >
          <ArrowLeft size={16} /> Back
        </button>
      )}

      {screen === "sector" && (
        <div>
          <p className="font-display text-[18px] font-semibold">What are you offering?</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {sectorsWithCategories.map((slug) => {
              const Icon = SECTORS[slug].icon;
              return (
                <button
                  key={slug}
                  onClick={() => {
                    setSectorSlug(slug);
                    goNext();
                  }}
                  className="tap-target flex flex-col items-center gap-2 rounded-2xl border border-border bg-bg-surface-raised p-5 text-center hover:border-accent-sky/50"
                >
                  <Icon size={28} className="text-accent-teal" />
                  <span className="text-[13px] font-semibold">{SECTORS[slug].name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {screen === "category" && (
        <div>
          <p className="font-display text-[18px] font-semibold">What kind of {sectorSlug && SECTORS[sectorSlug].name.toLowerCase()}?</p>
          <div className="mt-4 flex flex-col gap-2.5">
            {categoriesInSector.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCategoryId(c.id);
                  goNext();
                }}
                className="tap-target rounded-2xl border border-border bg-bg-surface-raised p-4 text-left text-[15px] font-medium hover:border-accent-sky/50"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {screen === "name" && (
        <div>
          <p className="font-display text-[18px] font-semibold">What do you call it?</p>
          <p className="mt-1 text-[13px] text-text-secondary">e.g. &quot;Prepaid SIM top-up&quot; or &quot;Weekly food combo&quot;</p>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Type here…"
            className="tap-target mt-4 w-full rounded-xl border border-border bg-bg-surface-raised px-4 py-4 text-[16px] outline-none focus:border-accent-sky"
          />
          <button
            onClick={goNext}
            disabled={!name.trim()}
            className="tap-target mt-5 w-full rounded-xl bg-accent-sky py-4 text-[15px] font-semibold text-[var(--text-on-accent-sky)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {screen === "price" && (
        <div>
          <p className="font-display text-[18px] font-semibold">How much does it cost?</p>
          <input
            autoFocus
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.00"
            className="tap-target mt-4 w-full rounded-xl border border-border bg-bg-surface-raised px-4 py-5 text-center font-mono text-[28px] outline-none focus:border-accent-sky"
          />
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => setCurrency(c.code)}
                className={clsx(
                  "tap-target rounded-full border px-4 py-2 text-[13px] font-semibold",
                  currency === c.code
                    ? "border-accent-sky bg-accent-sky/15 text-accent-sky"
                    : "border-border text-text-secondary",
                )}
              >
                {c.flag} {c.code}
              </button>
            ))}
          </div>
          <button
            onClick={goNext}
            disabled={!price || Number(price) <= 0}
            className="tap-target mt-5 w-full rounded-xl bg-accent-sky py-4 text-[15px] font-semibold text-[var(--text-on-accent-sky)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {screen.startsWith("attr:") &&
        category &&
        (() => {
          const field = category.attributeSchema.find((a) => `attr:${a.key}` === screen);
          if (!field) return null;
          return (
            <AttributeScreen
              field={field}
              value={attributeValues[field.key] ?? ""}
              onChange={(key, value) => setAttributeValues((prev) => ({ ...prev, [key]: value }))}
              onNext={goNext}
            />
          );
        })()}

      {screen === "images" && (
        <div>
          <p className="font-display text-[18px] font-semibold">Add a photo?</p>
          <p className="mt-1 text-[13px] text-text-secondary">
            The first photo shows on your listing&apos;s card. Tap a photo to make it the first one — or skip this
            for now.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {images.map((url, i) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element -- just-uploaded preview from our own storage bucket */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-accent-sky px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-on-accent-sky)]">
                    <Star size={10} fill="currentColor" /> Cover
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setImages((prev) => removeAt(prev, i))}
                  aria-label="Remove photo"
                  className="tap-target absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X size={13} />
                </button>
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => setImages((prev) => setCover(prev, i))}
                    className="absolute inset-x-0 bottom-0 bg-black/50 py-1 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100"
                  >
                    Make cover
                  </button>
                )}
              </div>
            ))}

            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="tap-target flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-text-muted disabled:opacity-50"
              >
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                <span className="text-[11px] font-medium">{uploading ? "Uploading…" : "Add photo"}</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              handleFileChosen(e.target.files);
              e.target.value = "";
            }}
          />

          {imageError && <p className="mt-3 text-[13px] text-accent-coral">{imageError}</p>}

          <button
            onClick={goNext}
            className="tap-target mt-5 w-full rounded-xl bg-accent-sky py-4 text-[15px] font-semibold text-[var(--text-on-accent-sky)]"
          >
            {images.length > 0 ? "Next" : "Skip for now"}
          </button>
        </div>
      )}

      {screen === "review" && (
        <div>
          <p className="font-display text-[18px] font-semibold">Ready to send?</p>
          <div className="mt-4 space-y-2 rounded-2xl border border-border bg-bg-surface-raised p-4 text-[14px]">
            {images[0] && (
              // eslint-disable-next-line @next/next/no-img-element -- just-uploaded preview from our own storage bucket
              <img src={images[0]} alt="" className="mb-2 h-32 w-full rounded-xl object-cover" />
            )}
            <p>
              <span className="text-text-muted">Offering: </span>
              <span className="font-semibold">{name}</span>
            </p>
            <p>
              <span className="text-text-muted">Price: </span>
              <span className="font-mono font-semibold">
                {CURRENCIES.find((c) => c.code === currency)?.symbol}
                {price}
              </span>
            </p>
            {category?.attributeSchema.map((f) => {
              const v = attributeValues[f.key];
              if (!v) return null;
              return (
                <p key={f.key}>
                  <span className="text-text-muted">{f.label}: </span>
                  <span className="font-semibold">
                    {f.dataType === "boolean" ? (v === "yes" ? "Yes" : "No") : v}
                    {f.unit && f.dataType === "number" ? ` ${f.unit}` : ""}
                  </span>
                </p>
              );
            })}
          </div>

          {error && <p className="mt-3 text-[13px] text-accent-coral">{error}</p>}

          <button
            onClick={() => submit("pending_review")}
            disabled={loading !== null}
            className="tap-target mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-teal py-4 text-[15px] font-semibold text-[#0b1512] disabled:opacity-50"
          >
            <Send size={17} />
            {loading === "pending_review" ? "Sending…" : "Send for review"}
          </button>
          <button
            onClick={() => submit("draft")}
            disabled={loading !== null}
            className="tap-target mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3.5 text-[14px] font-medium text-text-secondary disabled:opacity-50"
          >
            <Save size={15} />
            {loading === "draft" ? "Saving…" : "Save for later instead"}
          </button>
        </div>
      )}
    </div>
  );
}

function AttributeScreen({
  field,
  value,
  onChange,
  onNext,
}: {
  field: AttributeField;
  value: string;
  onChange: (key: string, value: string) => void;
  onNext: () => void;
}) {
  if (field.dataType === "boolean") {
    return (
      <div>
        <p className="font-display text-[18px] font-semibold">{field.label}?</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["yes", "no"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(field.key, opt);
                onNext();
              }}
              className={clsx(
                "tap-target rounded-2xl border py-6 text-[16px] font-semibold capitalize",
                value === opt ? "border-accent-sky bg-accent-sky/15 text-accent-sky" : "border-border bg-bg-surface-raised",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="font-display text-[18px] font-semibold">
        {field.label}
        {field.unit ? ` (${field.unit})` : ""}?
      </p>
      <input
        autoFocus
        inputMode={field.dataType === "number" ? "decimal" : "text"}
        value={value}
        onChange={(e) => onChange(field.key, field.dataType === "number" ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)}
        placeholder="Type here… (or leave blank to skip)"
        className="tap-target mt-4 w-full rounded-xl border border-border bg-bg-surface-raised px-4 py-4 text-[16px] outline-none focus:border-accent-sky"
      />
      <button
        onClick={onNext}
        className="tap-target mt-5 w-full rounded-xl bg-accent-sky py-4 text-[15px] font-semibold text-[var(--text-on-accent-sky)]"
      >
        Next
      </button>
    </div>
  );
}
