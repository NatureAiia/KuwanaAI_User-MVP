import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Public, cheap, no auth — reference exchange rates, not user data. */
export async function GET() {
  const rates = await prisma.fxRate.findMany();
  return NextResponse.json({
    rates: Object.fromEntries(rates.map((r) => [r.code, r.perUsd])),
    fetchedAt: rates.length > 0 ? rates.reduce((max, r) => (r.fetchedAt > max ? r.fetchedAt : max), rates[0].fetchedAt) : null,
  });
}
