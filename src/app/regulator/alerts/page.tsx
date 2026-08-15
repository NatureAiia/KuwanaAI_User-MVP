import { ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRegulatorUser } from "@/lib/regulatorAuth";
import { getPriceCapRulesWithBreaches, syncPriceCapNotifications } from "@/lib/priceCapAlerts";
import { Card, Badge } from "@/components/ui/Card";
import { PriceCapRuleForm } from "@/components/regulator/PriceCapRuleForm";
import { PriceCapRuleRowActions } from "@/components/regulator/PriceCapRuleRowActions";

export default async function RegulatorAlertsPage() {
  await requireRegulatorUser();

  const [rules, categories] = await Promise.all([
    getPriceCapRulesWithBreaches(),
    prisma.category.findMany({ include: { sector: true }, orderBy: { name: "asc" } }),
  ]);
  await syncPriceCapNotifications(rules);

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Gazetted price caps</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Set a ceiling for a category; every published listing priced above it is flagged here, re-checked every time
        you open this page.
      </p>

      <div className="mt-6">
        <PriceCapRuleForm categories={categories} />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {rules.map((rule) => (
          <Card key={rule.id} className="flex flex-wrap items-start justify-between gap-3 !p-3.5">
            <div className="flex items-start gap-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  rule.breaches.length > 0 ? "bg-accent-coral/10 text-accent-coral" : "bg-accent-teal/10 text-accent-teal"
                }`}
              >
                <ShieldAlert size={16} strokeWidth={2} />
              </span>
              <div>
                <p className="text-[13.5px] font-medium">
                  {rule.sectorName} / {rule.categoryName} capped at {rule.currency} {Number(rule.capValue)}
                </p>
                {rule.breaches.length === 0 ? (
                  <p className="text-[11px] text-text-muted">No published listing above the cap right now.</p>
                ) : (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {rule.breaches.map((b) => (
                      <p key={b.listingId} className="text-[11px] text-text-secondary">
                        {b.listingName} ({b.providerName}) — {rule.currency} {b.price.toFixed(2)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {rule.enabled && (
                <Badge tone={rule.breaches.length > 0 ? "coral" : "teal"}>
                  {rule.breaches.length > 0 ? `${rule.breaches.length} breaching` : "OK"}
                </Badge>
              )}
              <PriceCapRuleRowActions id={rule.id} enabled={rule.enabled} />
            </div>
          </Card>
        ))}
        {rules.length === 0 && <p className="text-[13px] text-text-muted">No price caps set up yet.</p>}
      </div>
    </div>
  );
}
