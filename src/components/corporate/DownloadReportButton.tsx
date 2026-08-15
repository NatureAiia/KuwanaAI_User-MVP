"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  downloadMarketIntelligencePdf,
  downloadChangeRequestSummaryPdf,
  type MarketIntelligenceReportData,
  type ChangeRequestSummaryRow,
} from "@/lib/corporateReports";

export function DownloadMarketIntelligenceReportButton({ data }: { data: MarketIntelligenceReportData }) {
  return (
    <Button onClick={() => downloadMarketIntelligencePdf(data)} className="gap-1.5">
      <Download size={15} />
      Download PDF
    </Button>
  );
}

export function DownloadChangeRequestSummaryButton({
  providerName,
  rows,
}: {
  providerName: string;
  rows: ChangeRequestSummaryRow[];
}) {
  return (
    <Button onClick={() => downloadChangeRequestSummaryPdf(providerName, rows)} className="gap-1.5">
      <Download size={15} />
      Download PDF
    </Button>
  );
}
