"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImagePlus, RotateCcw, Star, X } from "lucide-react";
import { MAX_IMAGES, reorder, removeAt } from "@/components/provider/imageGallery";

type PendingUpload = { file: File; status: "uploading" | "error"; message?: string };

/**
 * Controlled `images: string[]` field — first element is the cover image.
 * Uploads immediately on file select, one file per request (see the plan's
 * decision on proxy.ts's 10MB default body-size buffering), so each tile
 * gets its own progress/error/retry state independent of the others.
 */
export function ImageGalleryField({
  images,
  onChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);

  async function uploadOne(file: File) {
    setPending((p) => [...p, { file, status: "uploading" }]);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/provider/listings/images", { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = typeof data?.error === "string" ? data.error : "Upload failed";
        setPending((p) => p.map((t) => (t.file === file ? { file, status: "error", message } : t)));
        return;
      }
      onChange([...images, data.url]);
      setPending((p) => p.filter((t) => t.file !== file));
    } catch {
      setPending((p) =>
        p.map((t) => (t.file === file ? { file, status: "error", message: "Upload failed — check your connection" } : t)),
      );
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_IMAGES - images.length - pending.length;
    for (const file of Array.from(files).slice(0, Math.max(0, remaining))) {
      // Sequential (not Promise.all) so tile order stays deterministic.
      await uploadOne(file);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const canAddMore = images.length + pending.length < MAX_IMAGES;

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {images.map((url, i) => (
          <div
            key={url}
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-bg-surface-raised"
          >
            <Image src={url} alt="" fill sizes="96px" className="object-cover" />
            {i === 0 && (
              <span className="absolute left-1 top-1 flex items-center gap-1 rounded-full bg-accent-teal/90 px-1.5 py-0.5 text-[10px] font-semibold text-[#0b1512]">
                <Star size={10} fill="currentColor" /> Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(removeAt(images, i))}
              aria-label="Remove photo"
              className="tap-target absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X size={11} />
            </button>
            <div className="absolute inset-x-1 bottom-1 flex justify-center gap-1">
              <button
                type="button"
                onClick={() => onChange(reorder(images, i, i - 1))}
                disabled={i === 0}
                aria-label="Move left"
                className="tap-target flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                type="button"
                onClick={() => onChange(reorder(images, i, i + 1))}
                disabled={i === images.length - 1}
                aria-label="Move right"
                className="tap-target flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ))}

        {pending.map((t) => (
          <div
            key={`${t.file.name}-${t.file.lastModified}`}
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-bg-surface-raised p-1.5 text-center"
          >
            {t.status === "uploading" ? (
              <span className="text-[11px] text-text-muted">Uploading…</span>
            ) : (
              <>
                <span className="text-[10px] leading-tight text-accent-coral">{t.message}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPending((p) => p.filter((x) => x.file !== t.file));
                      uploadOne(t.file);
                    }}
                    aria-label="Retry upload"
                    className="tap-target rounded-full border border-border p-1"
                  >
                    <RotateCcw size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPending((p) => p.filter((x) => x.file !== t.file))}
                    aria-label="Dismiss"
                    className="tap-target rounded-full border border-border p-1"
                  >
                    <X size={11} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {canAddMore && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="tap-target flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-text-muted hover:border-accent-sky/50 hover:text-accent-sky"
          >
            <ImagePlus size={20} />
            <span className="text-[11px] font-medium">Add photo</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />
      <p className="mt-2 text-[11px] text-text-muted">First photo is the cover. Up to {MAX_IMAGES} photos, 5MB each.</p>
    </div>
  );
}
