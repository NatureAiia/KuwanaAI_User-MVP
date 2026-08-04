import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const listing = await prisma.listing.findUnique({
  where: { id: "226fe75b-f2e7-43d0-9abc-49a28d3744c9" },
  select: { categoryId: true },
});
const other = await prisma.listing.findFirst({
  where: { categoryId: listing.categoryId, id: { not: "226fe75b-f2e7-43d0-9abc-49a28d3744c9" } },
  select: { id: true, name: true },
});
const user = await prisma.user.findFirst({ select: { id: true } });

if (!other || !user) {
  console.log("No suitable other listing / user found — skipping.");
} else {
  const c = await prisma.comparison.create({
    data: { userId: user.id, categoryId: listing.categoryId, listingIds: ["226fe75b-f2e7-43d0-9abc-49a28d3744c9", other.id] },
  });
  console.log(`Created comparison ${c.id} pairing with "${other.name}" (${other.id})`);
}
await prisma.$disconnect();
