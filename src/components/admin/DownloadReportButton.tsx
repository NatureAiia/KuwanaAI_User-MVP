"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadAdminPricingIntelligencePdf, type AdminPricingIntelligenceReportData } from "@/lib/adminReports";

export function DownloadPricingIntelligenceReportButton({ data }: { data: AdminPricingIntelligenceReportData }) {
  return (
    <Button onClick={() => downloadAdminPricingIntelligencePdf(data)} className="gap-1.5">
      <Download size={15} />
      Download PDF
    </Button>
  );
}
