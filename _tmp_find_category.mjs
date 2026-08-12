import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const categories = await prisma.category.findMany({
  include: { sector: true, listings: { where: { status: "published" }, take: 3 } },
});

for (const c of categories) {
  if (c.listings.length >= 2) {
    console.log(JSON.stringify({
      sector: c.sector.slug,
      categoryId: c.id,
      categoryName: c.name,
      ids: c.listings.slice(0, 2).map((l) => l.id),
    }));
    break;
  }
}

await prisma.$disconnect();
