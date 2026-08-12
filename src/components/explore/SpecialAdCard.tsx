import Image from "next/image";
import NeonBorder from "@/components/ui/NeonBorder";

/**
 * Placeholder slot for a paid special/promotion — currently a single static
 * image (no ad-serving backend exists yet). Swap the image/alt/rounded value
 * together if this becomes real inventory later.
 */
export function SpecialAdCard() {
  return (
    <div className="relative mx-auto mt-6 w-full max-w-[360px] overflow-hidden rounded-[24px] aspect-[4/5]">
      <Image
        src="/ads/variety-crusade-tech.png"
        alt="VarietyCrusadeTech — we buy, fix and sell preloved gadgets"
        fill
        className="rounded-[24px] object-cover"
        sizes="360px"
      />
      <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        Sponsored
      </span>
      <div className="pointer-events-none absolute inset-0">
        <NeonBorder rounded={24} />
      </div>
    </div>
  );
}
