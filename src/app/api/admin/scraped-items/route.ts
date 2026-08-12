import { privateJson } from "@/lib/apiResponse";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorized" }, { status: 403 });

  const statusParam = new URL(req.url).searchParams.get("status");
  const status = statusParam === "approved" || statusParam === "rejected" ? statusParam : "pending";

  const items = await prisma.scrapedItem.findMany({
    where: { status },
    include: {
      source: true,
      suggestedProvider: true,
      suggestedListing: { include: { category: true } },
    },
    orderBy: { discoveredAt: "desc" },
    take: 100,
  });

  return privateJson({ items });
}
