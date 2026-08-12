import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { computeDecisionScores } from "@/lib/scoring";
import { buildTotalCostSummary, isCostAttribute } from "@/lib/totalCost";
import { getListingRequirements, isRequirementAttribute } from "@/lib/eligibility";
import { TREND_ARROW } from "@/lib/listingDisplay";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";
import type { PriceTrend } from "@/lib/priceTrend";

/**
 * Client-side PDF export for the compare page. Rebuilds the on-screen
 * comparison table (attributes × listings) into a PDF, then appends the AI
 * recommendation and/or the traditional (Python) comparison when they exist.
 * Kept dependency-light: jspdf + jspdf-autotable only, no canvas/DOM capture.
 */

export type ShareRecommendation = {
  primary_option: {
    listing_id: string;
    provider_name: string;
    listing_title: string;
    value_score: number;
    total_cost_summary: string | null;
    key_differentiator: string;
  };
  alternative_options: {
    listing_id: string;
    provider_name: string;
    listing_title: string;
    key_differentiator: string;
  }[];
  eligibility_requirements: { listing_id: string; requirements_to_qualify: string[] }[];
  explanation: { summary: string; key_tradeoffs: string[]; data_traceability_notes: string };
  suggested_action: string;
  confidence: number;
};

export type ShareTraditionalResult = {
  winner: { name: string; score: number; why: string } | null;
  runnerUps: { name: string; score: number }[];
  note: string | null;
  text: string;
};

export type CompareShareData = {
  categoryName: string;
  listings: ListingDTO[];
  attributeSchema: AttributeSchemaFieldDTO[];
  trends: Record<string, PriceTrend | null>;
  recommendation?: ShareRecommendation | null;
  traditional?: ShareTraditionalResult | null;
};

function formatValue(value: unknown, dataType: AttributeSchemaFieldDTO["dataType"], unit: string | null): string {
  if (value === undefined || value === null) return "—";
  if (dataType === "boolean") return value ? "Yes" : "No";
  if (dataType === "number") return `${value}${unit ? ` ${unit}` : ""}`;
  return String(value);
}

function formatPrice(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`.trim();
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "comparison";
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(14, 165, 233); // accent-sky
  doc.text(title, 14, y);
  doc.setTextColor(30, 41, 59);
  return y + 6;
}

function paragraph(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, fontSize = 10, lineHeight = 5): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, maxWidth);
  for (const line of lines) {
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

export function downloadComparePdf(data: CompareShareData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`Compare ${data.categoryName}`, margin, y + 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Kuwana comparison — generated ${new Date().toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" })}`,
    margin,
    y + 55,
  );
  y += 70;

  // Comparison table
  const scores = computeDecisionScores(data.listings, data.attributeSchema, data.trends);
  const head = ["Attribute", ...data.listings.map((l) => `${l.name} (${l.provider.name})`)];
  const body: (string | string[])[][] = [];

  if (data.attributeSchema.some((a) => isRequirementAttribute(a.key))) {
    const row: (string | string[])[] = ["To qualify"];
    for (const l of data.listings) {
      const reqs = getListingRequirements(l, data.attributeSchema);
      row.push(reqs.length === 0 ? "No stated requirement" : reqs.map((r) => `${r.label}: ${String(r.value)}${r.unit ? ` ${r.unit}` : ""}`));
    }
    body.push(row);
  }

  body.push(["Price", ...data.listings.map((l) => formatPrice(l.price, l.currency))]);

  if (data.attributeSchema.some((a) => isCostAttribute(a.key))) {
    body.push([
      "Total cost",
      ...data.listings.map((l) => buildTotalCostSummary(l, data.attributeSchema) ?? "—"),
    ]);
  }

  body.push([
    "Price trend",
    ...data.listings.map((l) => {
      const t = data.trends[l.id];
      return t ? `${TREND_ARROW[t.direction]} ${Math.abs(t.changePercent)}% / ${t.periodDays}d` : "—";
    }),
  ]);

  body.push([
    "Decision score",
    ...data.listings.map((l) => {
      const b = scores[l.id];
      return b ? `${b.total}/100 (price ${b.priceScore}${b.benefitScore !== null ? ` · fit ${b.benefitScore}` : ""})` : "—";
    }),
  ]);

  for (const attr of data.attributeSchema.filter((a) => a.isComparable && !isRequirementAttribute(a.key))) {
    body.push([
      attr.label,
      ...data.listings.map((l) => formatValue(l.attributes[attr.key], attr.dataType, attr.unit)),
    ]);
  }

  autoTable(doc, {
    head: [head],
    body,
    startY: y,
    margin: { left: margin, right: margin, top: 40, bottom: 40 },
    styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 } },
  });

  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  y = (lastTable?.finalY ?? doc.internal.pageSize.getHeight() - 80) + 24;
  const needsPage = y > doc.internal.pageSize.getHeight() - 80;
  if (needsPage) {
    doc.addPage();
    y = 50;
  }

  // Traditional comparison section
  if (data.traditional) {
    const t = data.traditional;
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 50;
    }
    y = sectionTitle(doc, "Traditional comparison", y) + 2;
    if (t.winner) {
      y = paragraph(doc, `Winner: ${t.winner.name} — ${t.winner.score}/100`, margin, y, contentWidth, 10) + 2;
      y = paragraph(doc, `Why: ${t.winner.why}`, margin, y, contentWidth, 9) + 2;
    }
    if (t.runnerUps.length > 0) {
      y = paragraph(
        doc,
        `Runner-up: ${t.runnerUps.map((r) => `${r.name} (${r.score}/100)`).join(" — ")}`,
        margin,
        y,
        contentWidth,
        9,
      ) + 2;
    }
    if (t.note) {
      y = paragraph(doc, t.note, margin, y + 2, contentWidth, 8) + 4;
    }
    y += 12;
  }

  // Kuwana recommendation section
  if (data.recommendation) {
    const rec = data.recommendation;
    if (y > doc.internal.pageSize.getHeight() - 160) {
      doc.addPage();
      y = 50;
    }
    y = sectionTitle(doc, "Kuwana recommendation", y) + 2;
    y = paragraph(doc, rec.explanation.summary, margin, y, contentWidth, 9) + 2;
    y = paragraph(doc, `Best for you: ${rec.primary_option.listing_title} (${rec.primary_option.provider_name})`, margin, y, contentWidth);
    const recLines: string[] = [];
    recLines.push(`Decision score: ${rec.primary_option.value_score}/100`);
    if (rec.primary_option.total_cost_summary) recLines.push(`Total cost: ${rec.primary_option.total_cost_summary}`);
    if (rec.primary_option.key_differentiator) recLines.push(`Why: ${rec.primary_option.key_differentiator}`);
    if (rec.alternative_options.length > 0) {
      recLines.push(
        `Runner-up: ${rec.alternative_options.map((a) => `${a.listing_title} — ${a.key_differentiator}`).join(" | ")}`,
      );
    }
    if (rec.suggested_action) recLines.push(`Suggested next step: ${rec.suggested_action}`);
    y = paragraph(doc, recLines.join("\n"), margin + 4, y + 2, contentWidth - 8, 9, 4.5);
    y += 12;
  }

  // Disclaimer
  if (y > doc.internal.pageSize.getHeight() - 70) {
    doc.addPage();
    y = 50;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  y = paragraph(
    doc,
    "Kuwana is not a financial or advisory service — we help you make your own informed decision. This " +
      "comparison and any recommendation are for informational purposes only.",
    margin,
    y,
    contentWidth,
    8,
  );

  doc.save(`kuwana-compare-${slugify(data.categoryName)}.pdf`);
}
