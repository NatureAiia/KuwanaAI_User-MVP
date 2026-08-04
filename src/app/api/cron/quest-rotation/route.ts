import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { runQuestRotation } from "@scripts/quest-rotation/run";

export async function GET(req: Request) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  const result = await runQuestRotation();
  return NextResponse.json(result);
}
