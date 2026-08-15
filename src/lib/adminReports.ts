import { createReportDoc, sectionTitle, table, addDisclaimer, saveReport, slugify } from "@/lib/reportPdf";

export type AdminPricingIntelligenceReportData = {
  bySector: { sectorName: string; listingCount: number; outlierCount: number; belowPeerMedianCount: number }[];
  outliers: {
    listingName: string;
    providerName: string;
    sectorName: string;
    categoryName: string;
    price: number;
    currency: string;
    zScore: number;
  }[];
};

/**
 * Admin's counterpart to corporateReports.ts's downloadMarketIntelligencePdf
 * — same reportPdf.ts primitives, but a platform-wide snapshot (every
 * sector, every provider) rather than one provider's own view, since that's
 * the angle admin needs.
 */
export function downloadAdminPricingIntelligencePdf(data: AdminPricingIntelligenceReportData) {
  const report = createReportDoc("Pricing Intelligence — platform-wide");

  if (data.bySector.length > 0) {
    sectionTitle(report, "By sector");
    table(
      report,
      ["Sector", "Published listings", "Outliers", "Below peer median"],
      data.bySector.map((s) => [s.sectorName, String(s.listingCount), String(s.outlierCount), String(s.belowPeerMedianCount)]),
    );
  }

  if (data.outliers.length > 0) {
    sectionTitle(report, "Outlier listings");
    table(
      report,
      ["Listing", "Provider", "Sector / Category", "Price", "z-score"],
      data.outliers.map((o) => [
        o.listingName,
        o.providerName,
        `${o.sectorName} / ${o.categoryName}`,
        `${o.currency} ${o.price.toFixed(2)}`,
        o.zScore.toFixed(2),
      ]),
    );
  }

  addDisclaimer(report);
  saveReport(report, `kuwana-pricing-intelligence-${slugify(new Date().toISOString().slice(0, 10))}.pdf`);
}
