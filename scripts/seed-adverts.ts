/**
 * Seeds the initial advert set from the flyers already copied into
 * public/ads/. Idempotent (upsert by imageUrl) so re-running after adding a
 * new flyer file here doesn't duplicate the ones already seeded.
 *
 *   npx tsx scripts/seed-adverts.ts
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { prisma } from "@/lib/prisma";

const SEED_ADVERTS = [
  {
    imageUrl: "/ads/variety-crusade-tech.png",
    sponsorName: "VarietyCrusadeTech",
    tagline: "We buy, fix and sell preloved gadgets",
  },
  {
    imageUrl: "/ads/vv-business-flyer.png",
    sponsorName: "Variety Vault",
    tagline: "Your one-stop business marketplace",
  },
  {
    imageUrl: "/ads/techdoctor-crosstech.png",
    sponsorName: "TechDoctor × CrossTech",
    tagline: "Device repairs done right, the first time",
  },
  {
    imageUrl: "/ads/printwave-treywear.png",
    sponsorName: "PrintWave × TreyWear",
    tagline: "Custom prints, made to wear",
  },
  {
    imageUrl: "/ads/nexionai.png",
    sponsorName: "NexionAI",
    tagline: "Smarter tools for your everyday hustle",
  },
] as const;

async function seedAdverts() {
  for (const advert of SEED_ADVERTS) {
    const existing = await prisma.advert.findFirst({ where: { imageUrl: advert.imageUrl } });
    if (existing) {
      console.log(`[seed-adverts] "${advert.sponsorName}" already seeded — skipping.`);
      continue;
    }
    const created = await prisma.advert.create({ data: advert });
    console.log(`[seed-adverts] created "${created.sponsorName}" (${created.id}).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seedAdverts()
    .catch((err) => {
      console.error("[seed-adverts] failed:", err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
