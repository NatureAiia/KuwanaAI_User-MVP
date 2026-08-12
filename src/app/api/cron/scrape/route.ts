import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runScrape } from "@scripts/scrape/run";

export async function GET(req: Request) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const result = await runScrape();
  return NextResponse.json(result);
}
