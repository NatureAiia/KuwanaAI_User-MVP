"use client";

import { useState } from "react";
import { WaitlistInline } from "@/components/landing/WaitlistInline";
import { SECTORS, type SectorSlug } from "@/lib/sectors";

const COMING_SOON = Object.values(SECTORS).filter((s) => s.status === "coming_soon");

export function ComingSoonWaitlist() {
  const [sector, setSector] = useState<SectorSlug>(COMING_SOON[0]!.slug);

  return (
    <div className="flex w-full flex-col gap-3 md:max-w-[420px]">
      <select
        value={sector}
        onChange={(e) => setSector(e.target.value as SectorSlug)}
        className="tap-target rounded-xl border border-border bg-bg-surface px-4 py-3 text-[14px] outline-none focus:border-accent-sky"
      >
        {COMING_SOON.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
      <WaitlistInline key={sector} sector={sector} />
    </div>
  );
}
