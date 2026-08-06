import { Card } from "@/components/ui/Card";

export function ProviderStatsRow({
  total,
  draft,
  pendingReview,
  published,
  rejected,
  savedTotal,
  comparisonsTotal,
}: {
  total: number;
  draft: number;
  pendingReview: number;
  published: number;
  rejected: number;
  savedTotal: number;
  comparisonsTotal: number;
}) {
  const tiles = [
    { label: "Total products", value: total },
    { label: "Published", value: published },
    { label: "Needs review", value: pendingReview },
    { label: "Drafts", value: draft },
    { label: "Rejected", value: rejected },
    { label: "Saved by shoppers", value: savedTotal },
    { label: "In comparisons", value: comparisonsTotal },
  ];

  return (
    <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
      {tiles.map((t) => (
        <Card key={t.label} className="!p-3">
          <p className="font-mono text-[20px] font-bold">{t.value}</p>
          <p className="text-[11px] text-text-muted">{t.label}</p>
        </Card>
      ))}
    </div>
  );
}
