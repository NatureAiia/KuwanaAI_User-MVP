import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runFxRefresh } from "@scripts/fx-refresh/run";

export async function GET(req: Request) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const result = await runFxRefresh();
  return NextResponse.json(result);
}
