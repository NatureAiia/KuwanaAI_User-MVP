import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

/**
 * Shared jsPDF primitives, extracted from comparePdf.ts (the compare page's
 * PDF export, the only PDF builder that existed before this) so every new
 * "export as PDF" feature in the corporate/admin sections reuses the same
 * header/section/table/disclaimer look instead of each hand-rolling jsPDF
 * calls. Still dependency-light: jspdf + jspdf-autotable only.
 */

export type ReportDoc = {
  doc: jsPDF;
  margin: number;
  contentWidth: number;
  pageHeight: number;
  y: number;
};

export function createReportDoc(title: string, subtitle?: string): ReportDoc {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(title, margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    subtitle ?? `Kuwana for Business — generated ${new Date().toLocaleString("en-ZW", { dateStyle: "medium", timeStyle: "short" })}`,
    margin,
    55,
  );

  return { doc, margin, contentWidth, pageHeight, y: 70 };
}

export function sectionTitle(report: ReportDoc, title: string): void {
  const { doc, margin } = report;
  ensureSpace(report, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(14, 165, 233); // accent-sky
  doc.text(title, margin, report.y);
  doc.setTextColor(30, 41, 59);
  report.y += 6;
}

export function paragraph(report: ReportDoc, text: string, opts?: { fontSize?: number; lineHeight?: number; indent?: number }): void {
  const { doc, margin, contentWidth } = report;
  const fontSize = opts?.fontSize ?? 10;
  const lineHeight = opts?.lineHeight ?? 5;
  const x = margin + (opts?.indent ?? 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, contentWidth - (opts?.indent ?? 0));
  for (const line of lines) {
    ensureSpace(report, lineHeight + 4);
    doc.text(line, x, report.y);
    report.y += lineHeight;
  }
}

/** Adds a new page and resets `y` if there isn't roughly `needed` points of room left on the current one. */
export function ensureSpace(report: ReportDoc, needed: number): void {
  if (report.y + needed > report.pageHeight - 40) {
    report.doc.addPage();
    report.y = 50;
  }
}

export function table(report: ReportDoc, head: string[], body: RowInput[]): void {
  autoTable(report.doc, {
    head: [head],
    body,
    startY: report.y,
    margin: { left: report.margin, right: report.margin, top: 40, bottom: 40 },
    styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak", valign: "top" },
    headStyles: { fillColor: [2, 132, 199], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });
  const lastTable = (report.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  report.y = (lastTable?.finalY ?? report.y) + 24;
}

const DISCLAIMER =
  "Kuwana is not a financial or advisory service — we help you make your own informed decision. This " +
  "report is for informational purposes only.";

export function addDisclaimer(report: ReportDoc): void {
  ensureSpace(report, 40);
  const { doc } = report;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  paragraph(report, DISCLAIMER, { fontSize: 8 });
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";
}

export function saveReport(report: ReportDoc, filename: string): void {
  report.doc.save(filename);
}
