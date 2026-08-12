"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function AdvertForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [sponsorName, setSponsorName] = useState("");
  const [tagline, setTagline] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/adverts/images", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Upload failed");
        return;
      }
      setImageUrl(data.url);
    } catch {
      setError("Upload failed — check your connection");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function submit() {
    if (!imageUrl) {
      setError("Upload an image first");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/adverts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsorName, tagline, imageUrl }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not create advert");
        return;
      }
      setSponsorName("");
      setTagline("");
      setImageUrl(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-4">
      <p className="font-display text-[15px] font-semibold">New advert</p>
      <p className="mt-1 text-[12.5px] text-text-secondary">
        Rotates through the explore page&apos;s ad slot. Creating the first advert of a run starts the
        &ldquo;Open 3 adverts in 5 days&rdquo; quest for every user.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {imageUrl ? (
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border">
            <Image src={imageUrl} alt="" fill sizes="96px" className="object-cover" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="tap-target flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-text-muted hover:border-accent-sky/50 hover:text-accent-sky"
          >
            <ImagePlus size={20} />
            <span className="text-[11px] font-medium">{uploading ? "Uploading…" : "Add image"}</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => handleFile(e.target.files)}
          className="hidden"
        />

        <div className="flex min-w-[220px] flex-1 flex-col gap-2">
          <input
            placeholder="Sponsor name"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
          />
          <input
            placeholder="Tagline (shown on the card)"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="tap-target w-full rounded-lg border border-border bg-bg-surface p-2 text-[13px]"
          />
        </div>
      </div>

      {error && <p className="mt-2 text-[12px] text-accent-coral">{error}</p>}

      <Button
        size="md"
        onClick={submit}
        disabled={saving || uploading || !imageUrl || !sponsorName.trim() || !tagline.trim()}
        className="mt-3"
      >
        Create advert
      </Button>
    </div>
  );
}
