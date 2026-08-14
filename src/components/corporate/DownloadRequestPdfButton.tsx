"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { downloadCorporateRequestPdf, type CorporateRequestPdfData } from "@/lib/corporateRequestPdf";

export function DownloadRequestPdfButton({ data }: { data: CorporateRequestPdfData }) {
  return (
    <Button
      variant="ghost"
      onClick={() => downloadCorporateRequestPdf(data)}
      className="!px-2.5 !py-1 !text-[11px]"
    >
      <Download size={12} />
      PDF
    </Button>
  );
}
