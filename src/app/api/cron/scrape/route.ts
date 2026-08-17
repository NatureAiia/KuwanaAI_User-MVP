import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runScrape } from "@scripts/scrape/run";

export async function GET(req: Request) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const result = await runScrape();
  // A monitoring check keyed off HTTP status (rather than parsing the JSON
  // body) would otherwise never notice every source failing at once.
  if (result.total > 0 && result.failed === result.total) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
