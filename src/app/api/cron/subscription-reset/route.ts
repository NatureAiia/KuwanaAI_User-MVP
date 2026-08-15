import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runSubscriptionReset } from "@scripts/subscription-reset/run";

export async function GET(req: Request) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const result = await runSubscriptionReset();
  return NextResponse.json(result);
}
