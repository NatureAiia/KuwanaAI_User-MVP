import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cronAuth";
import { purgeStaleVerificationCodes } from "@/lib/email/verification";

/**
 * Drops signup verification codes past their retention window.
 *
 * Codes are already unusable long before this runs — they expire in minutes
 * and are consumed on first use — so this is retention hygiene rather than a
 * security control: without it the table becomes a permanent record of who
 * attempted to sign up and when.
 */
export async function GET(req: Request) {
  const denied = verifyCronRequest(req);
  if (denied) return denied;

  return NextResponse.json(await purgeStaleVerificationCodes());
}
