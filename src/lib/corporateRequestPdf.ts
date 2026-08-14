import { createReportDoc, sectionTitle, paragraph, addDisclaimer, saveReport, slugify } from "@/lib/reportPdf";

export type CorporateRequestPdfData = {
  id: string;
  type: "edit" | "new_listing";
  providerName: string;
  listingName: string;
  price: number;
  currency: string;
  previousPrice?: number | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewedByEmail?: string | null;
  reviewedAt?: Date | string | null;
  reviewNote?: string | null;
  rejectionReason?: string | null;
  createdAt: Date | string;
};

/** A single change-request's record as a standalone PDF — the "per-approval report" a business can keep for its own audit trail. */
export function downloadCorporateRequestPdf(data: CorporateRequestPdfData) {
  const report = createReportDoc(
    `${data.type === "edit" ? "Price/product change" : "New product"} — ${data.providerName}`,
  );

  sectionTitle(report, "Request");
  paragraph(report, `Listing: ${data.listingName}`);
  paragraph(
    report,
    `Price: ${data.currency} ${data.price.toFixed(2)}${
      data.previousPrice != null ? ` (was ${data.currency} ${data.previousPrice.toFixed(2)})` : ""
    }`,
  );
  paragraph(report, `Submitted: ${new Date(data.createdAt).toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" })}`);
  report.y += 6;

  sectionTitle(report, "Business's reason");
  paragraph(report, data.reason);
  report.y += 6;

  sectionTitle(report, "Review outcome");
  paragraph(report, `Status: ${data.status}`);
  if (data.reviewedByEmail && data.reviewedAt) {
    paragraph(
      report,
      `Reviewed by ${data.reviewedByEmail} on ${new Date(data.reviewedAt).toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" })}`,
    );
  }
  if (data.reviewNote) paragraph(report, `Sign-off note: ${data.reviewNote}`);
  if (data.rejectionReason) paragraph(report, `Rejection reason: ${data.rejectionReason}`);

  report.y += 10;
  addDisclaimer(report);

  saveReport(report, `kuwana-request-${slugify(data.listingName)}-${data.id.slice(0, 8)}.pdf`);
}
