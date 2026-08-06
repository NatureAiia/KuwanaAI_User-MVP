"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Escapes a value for a single CSV field per RFC 4180 (quote, double any embedded quotes). */
export function csvField(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function ExportCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  function download() {
    const csv = [headers, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n");
    // Leading BOM so Excel (the realistic destination for a "download as evidence"
    // export) doesn't mangle currency symbols/non-ASCII sector names as Latin-1.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" size="md" onClick={download} className="gap-1.5">
      <Download size={15} />
      Export CSV
    </Button>
  );
}
