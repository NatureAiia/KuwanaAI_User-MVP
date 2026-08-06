"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function ProviderFilterBar({
  categories,
}: {
  categories: { id: string; name: string; sector: { name: string } }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/provider?${params.toString()}`);
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2.5">
      <div className="relative min-w-[200px] flex-1">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          key={searchParams.get("q") ?? ""}
          defaultValue={searchParams.get("q") ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParam("q", e.currentTarget.value);
          }}
          onBlur={(e) => updateParam("q", e.target.value)}
          placeholder="Search your products…"
          className="tap-target w-full rounded-xl border border-border bg-bg-surface-raised py-2.5 pl-9 pr-3 text-[13.5px] outline-none focus:border-accent-sky"
        />
      </div>
      <select
        value={searchParams.get("categoryId") ?? ""}
        onChange={(e) => updateParam("categoryId", e.target.value)}
        className="tap-target rounded-xl border border-border bg-bg-surface-raised px-3 py-2.5 text-[13.5px] outline-none focus:border-accent-sky"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.sector.name} · {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
