import { notFound } from "next/navigation";
import { Bell } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getAdminAlertRulesWithStatus, ADMIN_METRIC_LABEL } from "@/lib/adminAlerts";
import { Card, Badge } from "@/components/ui/Card";
import { AdminAlertRuleForm } from "@/components/admin/AdminAlertRuleForm";
import { AdminAlertRuleRowActions } from "@/components/admin/AdminAlertRuleRowActions";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function AdminAlertsPage() {
  const admin = await requireAdmin();
  if (!admin) notFound();

  const rules = await getAdminAlertRulesWithStatus();

  return (
    <div className="mx-auto max-w-[900px] px-5 py-8 md:px-10">
      <h1 className="font-display text-[24px] font-bold">Alerts</h1>
      <p className="mt-1 text-[13px] text-text-secondary">
        Watch platform-wide metrics — re-checked every time you open this page. Distinct from Business conditions
        (manually curated context) and each provider&apos;s own self-service alerts.
      </p>

      <div className="mt-6">
        <AdminAlertRuleForm />
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
                  {ADMIN_METRIC_LABEL[rule.metric]} {rule.direction === "above" ? "rises above" : "drops below"}{" "}
                  {Number(rule.threshold)}
                </p>
                <p className="text-[11px] text-text-muted">Currently {rule.currentValue.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {rule.enabled && (
                <Badge tone={rule.triggered ? "coral" : "teal"}>{rule.triggered ? "Triggered" : "OK"}</Badge>
              )}
              <AdminAlertRuleRowActions id={rule.id} enabled={rule.enabled} />
            </div>
          </Card>
        ))}
        {rules.length === 0 && (
          <EmptyState
            title="No alert rules yet."
            description="Add one using the form above to get notified when a platform metric crosses a threshold."
          />
        )}
      </div>
    </div>
  );
}
