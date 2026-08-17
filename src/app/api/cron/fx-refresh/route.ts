import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runFxRefresh } from "@scripts/fx-refresh/run";

export async function GET(req: Request) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  try {
    const result = await runFxRefresh();
    if (result.failed > 0 && result.updated === 0) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[fx-refresh] cron run failed:", err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
