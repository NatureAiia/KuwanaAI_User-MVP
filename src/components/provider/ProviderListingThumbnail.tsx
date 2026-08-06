import Image from "next/image";
import { Package } from "lucide-react";

export function ProviderListingThumbnail({
  images,
  name,
  size = 40,
}: {
  images: string[];
  name: string;
  size?: number;
}) {
  if (images[0]) {
    return (
      <div
        className="shrink-0 overflow-hidden rounded-lg border border-border bg-bg-surface-raised"
        style={{ width: size, height: size }}
      >
        <Image src={images[0]} alt={name} width={size} height={size} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-bg-surface-raised text-text-muted"
      style={{ width: size, height: size }}
    >
      <Package size={Math.round(size * 0.45)} />
    </div>
  );
}
