"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X } from "lucide-react";

export function AdvertLightbox({
  imageUrl,
  sponsorName,
  onClose,
}: {
  imageUrl: string;
  sponsorName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${sponsorName} advert`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
    >
      <div className="relative max-h-[80vh] w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="tap-target absolute -top-11 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X size={18} />
        </button>
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[24px]">
          <Image src={imageUrl} alt={sponsorName} fill className="object-cover" sizes="420px" />
        </div>
      </div>
    </div>
  );
}
