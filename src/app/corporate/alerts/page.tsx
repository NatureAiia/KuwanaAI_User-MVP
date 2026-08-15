import { Bell } from "lucide-react";
import { requireCorporateProvider } from "@/lib/corporateAuth";
import { getAlertRulesWithStatus, syncAlertRuleNotifications, METRIC_LABEL } from "@/lib/alerts";
import { NotLinkedCard } from "@/components/corporate/NotLinkedCard";
import { Card, Badge } from "@/components/ui/Card";
import { AlertRuleForm } from "@/components/corporate/AlertRuleForm";
import { AlertRuleRowActions } from "@/components/corporate/AlertRuleRowActions";

export default async function CorporateAlertsPage() {
  const result = await requireCorporateProvider();
  if ("notLinked" in result) return <NotLinkedCard />;
  const { provider } = result;

  const rules = await getAlertRulesWithStatus(provider.id);
  await syncAlertRuleNotifications(rules);

  return (
    <div>
      <h1 className="font-display text-[20px] font-bold">Alerts</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Watch your own metrics — re-checked every time you open this page.
      </p>

      <div className="mt-6">
        <AlertRuleForm />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {rules.map((rule) => (
          <Card key={rule.id} className="flex flex-wrap items-center justify-between gap-3 !p-3.5">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  rule.triggered ? "bg-accent-coral/10 text-accent-coral" : "bg-accent-teal/10 text-accent-teal"
                }`}
              >
                <Bell size={16} strokeWidth={2} />
              </span>
              <div>
                <p className="text-[13.5px] font-medium">
                  {METRIC_LABEL[rule.metric]} {rule.direction === "above" ? "rises above" : "drops below"}{" "}
                  {Number(rule.threshold)}
                </p>
                <p className="text-[11px] text-text-muted">Currently {rule.currentValue.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {rule.enabled && (
                <Badge tone={rule.triggered ? "coral" : "teal"}>{rule.triggered ? "Triggered" : "OK"}</Badge>
              )}
              <AlertRuleRowActions id={rule.id} enabled={rule.enabled} />
            </div>
          </Card>
        ))}
        {rules.length === 0 && <p className="text-[13px] text-text-muted">No alerts set up yet.</p>}
      </div>
    </div>
  );
}
