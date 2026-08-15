import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireConsumer } from "@/lib/auth";
import { privateJson } from "@/lib/apiResponse";

const bodySchema = z.object({
  listingId: z.string().uuid().optional(),
  description: z.string().trim().min(10).max(1000),
});

export async function POST(req: Request) {
  const auth = await requireConsumer();
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return privateJson({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.listingId) {
    const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId }, select: { id: true } });
    if (!listing) return privateJson({ error: "Listing not found" }, { status: 404 });
  }

  const complaint = await prisma.consumerComplaint.create({
    data: {
      userId: auth.user.id,
      listingId: parsed.data.listingId,
      description: parsed.data.description,
    },
  });

  return privateJson({ complaint });
}
