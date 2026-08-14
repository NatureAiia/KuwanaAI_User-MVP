import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaynowHash } from "@/lib/paynow";
import { applyPaynowStatusUpdate } from "@/lib/wallet";

/**
 * Paynow's "Result URL" — a server-to-server callback, not a browser
 * request, so there is no session to check. The hash is the only thing
 * standing between this route and an attacker forging a "paid" status, so
 * verification must happen before anything the payload says is trusted, and
 * any failure must reject rather than fall through.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const fields = Object.fromEntries(new URLSearchParams(raw));

  if (!fields.reference) return new NextResponse("Missing reference", { status: 400 });

  const tx = await prisma.walletTransaction.findUnique({ where: { reference: fields.reference } });
  if (!tx) return new NextResponse("Unknown reference", { status: 404 });

  if (!verifyPaynowHash(fields, tx.currency)) {
    return new NextResponse("Hash verification failed", { status: 400 });
  }

  await applyPaynowStatusUpdate(tx, { status: fields.status, paynowreference: fields.paynowreference });

  return new NextResponse("OK", { status: 200 });
}
