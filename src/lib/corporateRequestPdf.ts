import { createReportDoc, sectionTitle, paragraph, addDisclaimer, saveReport, slugify } from "@/lib/reportPdf";

const REQUEST_TYPE_TITLE: Record<"edit" | "new_listing" | "new_field", string> = {
  edit: "Price/product change",
  new_listing: "New product",
  new_field: "New comparison field",
};

export type CorporateRequestPdfData = {
  id: string;
  type: "edit" | "new_listing" | "new_field";
  providerName: string;
  listingName: string;
  // Absent for `new_field` — a field proposal has no price of its own.
  price?: number | null;
  currency?: string | null;
  previousPrice?: number | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewedByEmail?: string | null;
  reviewedAt?: Date | string | null;
  reviewNote?: string | null;
  rejectionReason?: string | null;
  createdAt: Date | string;
  // `new_field` only — the regulator sign-off stage, shown alongside the
  // final admin outcome above.
  regulatorDecision?: string | null;
  regulatorReviewedByEmail?: string | null;
  regulatorNote?: string | null;
};

/** A single change-request's record as a standalone PDF — the "per-approval report" a business can keep for its own audit trail. */
export function downloadCorporateRequestPdf(data: CorporateRequestPdfData) {
  const report = createReportDoc(`${REQUEST_TYPE_TITLE[data.type]} — ${data.providerName}`);

  sectionTitle(report, "Request");
  paragraph(report, `${data.type === "new_field" ? "Field" : "Listing"}: ${data.listingName}`);
  if (data.price != null && data.currency) {
    paragraph(
      report,
      `Price: ${data.currency} ${data.price.toFixed(2)}${
        data.previousPrice != null ? ` (was ${data.currency} ${data.previousPrice.toFixed(2)})` : ""
      }`,
    );
  }
  paragraph(report, `Submitted: ${new Date(data.createdAt).toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" })}`);
  report.y += 6;

  sectionTitle(report, "Business's reason");
  paragraph(report, data.reason);
  report.y += 6;

  if (data.type === "new_field" && data.regulatorDecision) {
    sectionTitle(report, "Regulator review");
    paragraph(report, `Decision: ${data.regulatorDecision}`);
    if (data.regulatorReviewedByEmail) paragraph(report, `Reviewed by ${data.regulatorReviewedByEmail}`);
    if (data.regulatorNote) paragraph(report, `Note: ${data.regulatorNote}`);
    report.y += 6;
  }

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
