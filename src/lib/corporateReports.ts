import { createReportDoc, sectionTitle, table, addDisclaimer, saveReport, slugify } from "@/lib/reportPdf";

export type MarketIntelligenceReportData = {
  providerName: string;
  bySector: { sectorName: string; avgPrice: number; listingCount: number; trendingDown: number; trendingUp: number }[];
  feeComparison: { listingName: string; categoryName: string; price: number; currency: string; peerMedian: number; isOutlier: boolean }[];
};

export function downloadMarketIntelligencePdf(data: MarketIntelligenceReportData) {
  const report = createReportDoc(`Market Intelligence — ${data.providerName}`);

  if (data.bySector.length > 0) {
    sectionTitle(report, "By sector");
    table(
      report,
      ["Sector", "Avg. price (USD)", "Listings", "Trending down", "Trending up"],
      data.bySector.map((s) => [s.sectorName, s.avgPrice.toFixed(2), String(s.listingCount), String(s.trendingDown), String(s.trendingUp)]),
    );
  }

  if (data.feeComparison.length > 0) {
    sectionTitle(report, "Fee comparison vs. category peers");
    table(
      report,
      ["Listing", "Category", "Price", "Peer median", "Flag"],
      data.feeComparison.map((f) => [
        f.listingName,
        f.categoryName,
        `${f.currency} ${f.price.toFixed(2)}`,
        f.peerMedian.toFixed(2),
        f.isOutlier ? "Worth a look" : "—",
      ]),
    );
  }

  addDisclaimer(report);
  saveReport(report, `kuwana-market-intelligence-${slugify(data.providerName)}.pdf`);
}

export type ChangeRequestSummaryRow = {
  listingName: string;
  type: "edit" | "new_listing";
  status: "pending" | "approved" | "rejected";
  price: number;
  currency: string;
  createdAt: Date | string;
  reviewedAt?: Date | string | null;
};

export function downloadChangeRequestSummaryPdf(providerName: string, rows: ChangeRequestSummaryRow[]) {
  const report = createReportDoc(`Change Requests — ${providerName}`);

  sectionTitle(report, `${rows.length} request(s)`);
  table(
    report,
    ["Listing", "Type", "Price", "Status", "Submitted", "Reviewed"],
    rows.map((r) => [
      r.listingName,
      r.type === "edit" ? "Edit" : "New product",
      `${r.currency} ${r.price.toFixed(2)}`,
      r.status,
      new Date(r.createdAt).toLocaleDateString("en-ZW"),
      r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString("en-ZW") : "—",
    ]),
  );

  addDisclaimer(report);
  saveReport(report, `kuwana-change-requests-${slugify(providerName)}.pdf`);
}
