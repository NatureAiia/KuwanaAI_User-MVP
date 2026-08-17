import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaynowHash } from "@/lib/paynow";
import { applyPaynowStatusUpdate } from "@/lib/wallet";
import { enforceRateLimit, clientKey, RATE_LIMITS } from "@/lib/rateLimit";

/**
 * Paynow's "Result URL" — a server-to-server callback, not a browser
 * request, so there is no session to check. The hash is the only thing
 * standing between this route and an attacker forging a "paid" status, so
 * verification must happen before anything the payload says is trusted, and
 * any failure must reject rather than fall through.
 */

/**
 * One response for every rejection.
 *
 * Returning 404 for an unknown reference and 400 for a bad hash told an
 * unauthenticated caller which references exist — enough to enumerate live
 * transaction ids by probing with a junk hash, before ever attempting to forge
 * one. Paynow does not read the status text, so there is nothing to lose by
 * making the two indistinguishable.
 */
function reject() {
  return new NextResponse("Rejected", { status: 400 });
}

export async function POST(req: Request) {
  // The only unauthenticated write path in the app, and it reaches the wallet.
  // Keyed on the best-effort client identity — spoofable in principle, which
  // is why it is a flood control and not the access control; the hash is that.
  const limited = await enforceRateLimit(`paynow-webhook:${clientKey(req)}`, RATE_LIMITS.publicWrite);
  if (limited) return limited;

  const raw = await req.text();
  const fields = Object.fromEntries(new URLSearchParams(raw));

  if (!fields.reference) return reject();

  const tx = await prisma.walletTransaction.findUnique({ where: { reference: fields.reference } });
  if (!tx) return reject();

  if (!verifyPaynowHash(fields, tx.currency)) return reject();

  await applyPaynowStatusUpdate(tx, {
    status: fields.status,
    paynowreference: fields.paynowreference,
    // Checked against the stored amount before anything is credited — see
    // applyPaynowStatusUpdate. A verified hash means Paynow sent this; it does
    // not mean the customer paid what we asked for.
    amount: fields.amount,
  });

  return new NextResponse("OK", { status: 200 });
}
