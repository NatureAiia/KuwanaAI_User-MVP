import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getListingPriceTrends } from "@/lib/catalog";
import { computeDecisionScores } from "@/lib/scoring";
import type { AttributeSchemaFieldDTO, ListingDTO } from "@/types/catalog";

const bodySchema = z.object({
  listingIds: z.array(z.string()).min(2).max(10),
});

/**
 * "Traditional comparison" — a deterministic, rules-based engine written in
 * Python (scripts/traditional_compare.py), deliberately not an AI/LLM. The
 * route resolves the requested listings server-side (so nothing but listing
 * IDs travels to the engine), feeds them to the script over stdin, and
 * returns the engine's printed output verbatim for the UI to show under a
 * clearly-labelled panel. No auth required: unlike the AI recommendation it
 * needs no user context, and anonymous comparison is already supported.
 */
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid listing selection" }, { status: 400 });
  }
  const { listingIds } = parsed.data;

  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds }, status: "published" },
    include: { provider: true, category: { include: { attributeSchema: true } } },
  });
  if (listings.length < 2) {
    return NextResponse.json({ error: "Need at least 2 listings" }, { status: 400 });
  }

  const category = listings[0].category;
  const listingDTOs: ListingDTO[] = listings.map((l) => ({
    id: l.id,
    name: l.name,
    price: Number(l.price),
    currency: l.currency,
    attributes: l.attributes as Record<string, unknown>,
    freshnessStatus: l.freshnessStatus,
    lastVerifiedAt: l.lastVerifiedAt.toISOString(),
    sourceUrl: l.sourceUrl,
    images: l.images,
    description: l.description ?? null,
    rating: l.rating === null || l.rating === undefined ? null : Number(l.rating),
    reviewCount: l.reviewCount ?? 0,
    provider: l.provider,
  }));
  const attributeSchema: AttributeSchemaFieldDTO[] = category.attributeSchema.map((a) => ({
    key: a.key,
    label: a.label,
    dataType: a.dataType as AttributeSchemaFieldDTO["dataType"],
    unit: a.unit,
    isComparable: a.isComparable,
    sortOrder: a.sortOrder,
  }));
  const trends = await getListingPriceTrends(listingDTOs.map((l) => l.id));
  computeDecisionScores(listingDTOs, attributeSchema, trends);

  const payload = {
    category_name: category.name,
    category_slug: category.slug,
    attribute_schema: attributeSchema.map((a) => ({
      key: a.key,
      label: a.label,
      data_type: a.dataType,
      unit: a.unit,
      is_comparable: a.isComparable,
      sort_order: a.sortOrder,
    })),
    listings: listingDTOs.map((l) => ({
      id: l.id,
      name: l.name,
      provider: l.provider.name,
      provider_verified: l.provider.verified,
      price: l.price,
      currency: l.currency,
      attributes: l.attributes,
      freshness_status: l.freshnessStatus,
      trend_percent: trends[l.id]?.changePercent ?? null,
    })),
  };

  try {
    const text = await runPythonEngine(payload);
    return NextResponse.json({
      engine: "traditional",
      categoryName: category.name,
      text,
    });
  } catch (err) {
    console.error("[traditional-comparison] engine failed:", err);
    const message = err instanceof Error ? err.message : "Unknown engine error";
    const timedOut = message.includes("timed out");
    return NextResponse.json(
      { error: timedOut ? "The comparison engine took too long — try again." : "The comparison engine isn't available right now." },
      { status: 503 },
    );
  }
}

function runPythonEngine(payload: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const cwd = process.cwd();
    const candidates = [
      process.env.PYTHON_BIN,
      path.join(cwd, ".venv", "Scripts", "python.exe"),
      path.join(cwd, ".venv", "bin", "python"),
      "python",
    ].filter(Boolean) as string[];
    const pythonBin = candidates.find((c) => c === "python" || existsSync(c)) ?? "python";

    const scriptPath = path.join(cwd, "scripts", "traditional_compare.py");
    // `-X utf8` + PYTHONIOENCODING keep the script's stdout as UTF-8 even on
    // Windows, where a piped stdout would otherwise fall back to cp1252 and
    // mangle the "—"/"·" glyphs before Node decodes the stream.
    const child = spawn(pythonBin, ["-X", "utf8", scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("engine timed out"));
    }, 20_000);

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `engine exited with code ${code}`));
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}
