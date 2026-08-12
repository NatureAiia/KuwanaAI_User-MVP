import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { setListingPinned } from "@/lib/catalog";

const PinBody = z.object({ listingId: z.string().uuid(), pinned: z.boolean() });

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = PinBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await setListingPinned(user.id, parsed.data.listingId, parsed.data.pinned);
  return NextResponse.json({ ok: true });
}
