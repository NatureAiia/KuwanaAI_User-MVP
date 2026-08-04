import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runFreshnessDecay } from "@scripts/freshness-decay/run";

export async function GET(req: Request) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const result = await runFreshnessDecay();
  return NextResponse.json(result);
}
