"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { BulkPriceUpdateResult } from "@/app/api/corporate/listings/bulk-price-update/route";

type ParsedRow = {
  listingId: string;
  price: number;
  reason: string;
  listingName: string | null;
  error: string | null;
};

/** Splits "a,b,\"c, with comma\"" into ["a","b","c, with comma"] — the one quoting case worth handling for a reason column that might contain a comma. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function BulkPriceUpdateForm({ listingsById }: { listingsById: Record<string, string> }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [results, setResults] = useState<BulkPriceUpdateResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setResults(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setError("CSV needs a header row plus at least one data row");
        return;
      }

      const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
      const idIdx = header.indexOf("listing_id");
      const priceIdx = header.indexOf("price");
      const reasonIdx = header.indexOf("reason");
      if (idIdx === -1 || priceIdx === -1 || reasonIdx === -1) {
        setError('Header row must include "listing_id", "price", and "reason" columns');
        return;
      }

      const parsed: ParsedRow[] = lines.slice(1).map((line) => {
        const cells = parseCsvLine(line);
        const listingId = cells[idIdx] ?? "";
        const price = Number(cells[priceIdx]);
        const reason = cells[reasonIdx] ?? "";
        const listingName = listingsById[listingId] ?? null;

        let rowError: string | null = null;
        if (!listingId) rowError = "Missing listing_id";
        else if (!listingName) rowError = "Not one of your listings";
        else if (!(price > 0)) rowError = "Invalid price";
        else if (!reason) rowError = "Missing reason";

        return { listingId, price, reason, listingName, error: rowError };
      });

      setRows(parsed);
    };
    reader.readAsText(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit() {
    const validRows = rows.filter((r) => !r.error);
    if (validRows.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/corporate/listings/bulk-price-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows.map((r) => ({ listingId: r.listingId, price: r.price, reason: r.reason })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ? JSON.stringify(data.error) : "Upload failed");
        return;
      }
      setResults(data.results);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const validCount = rows.filter((r) => !r.error).length;

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-bg-surface p-4">
      <p className="font-display text-[15px] font-semibold">Bulk price update</p>
      <p className="mt-1 text-[12.5px] text-text-secondary">
        Upload a CSV with columns <code className="rounded bg-bg-surface-raised px-1">listing_id</code>,{" "}
        <code className="rounded bg-bg-surface-raised px-1">price</code>, and{" "}
        <code className="rounded bg-bg-surface-raised px-1">reason</code>. Applies immediately, same as a
        one-at-a-time edit — no admin review hop.
      </p>

      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files)} className="hidden" />
      <Button variant="secondary" size="md" onClick={() => inputRef.current?.click()} className="mt-3 gap-1.5">
        <Upload size={15} />
        Choose CSV
      </Button>

      {error && <p className="mt-2 text-[12px] text-accent-coral">{error}</p>}

      {rows.length > 0 && !results && (
        <div className="mt-4">
          <p className="text-[12.5px] text-text-secondary">
            {validCount} of {rows.length} row(s) valid.
          </p>
          <div className="mt-2 max-h-[320px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b border-border bg-bg-surface-raised text-left">
                  <th className="p-2 font-medium text-text-muted">Listing</th>
                  <th className="p-2 font-medium text-text-muted">New price</th>
                  <th className="p-2 font-medium text-text-muted">Reason</th>
                  <th className="p-2 font-medium text-text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-2">{row.listingName ?? row.listingId}</td>
                    <td className="p-2 font-mono">{Number.isFinite(row.price) ? row.price : "—"}</td>
                    <td className="p-2 text-text-secondary">{row.reason || "—"}</td>
                    <td className="p-2">
                      {row.error ? (
                        <span className="text-accent-coral">{row.error}</span>
                      ) : (
                        <span className="text-accent-teal">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={submit} disabled={submitting || validCount === 0} className="mt-3">
            {submitting ? "Applying…" : `Apply ${validCount} update(s)`}
          </Button>
        </div>
      )}

      {results && (
        <div className="mt-4 space-y-1">
          {results.map((r) => (
            <div key={r.listingId} className="flex items-center gap-1.5 text-[12.5px]">
              {r.ok ? (
                <CheckCircle2 size={14} className="text-accent-teal" />
              ) : (
                <XCircle size={14} className="text-accent-coral" />
              )}
              <span>{listingsById[r.listingId] ?? r.listingId}</span>
              {r.error && <span className="text-accent-coral">— {r.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
