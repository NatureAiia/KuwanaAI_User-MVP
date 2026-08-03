import { PrismaClient } from "@prisma/client";
const email = process.argv[2];
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("no user");
  const listings = await prisma.listing.findMany({ take: 2 });
  const ids = listings.map((l) => l.id);
  let convo = await prisma.conversation.findFirst({ where: { userId: user.id } });
  if (!convo) convo = await prisma.conversation.create({ data: { userId: user.id } });
  await prisma.message.create({
    data: {
      conversationId: convo.id,
      role: "assistant",
      content: `Based on what's available, ${listings[0].name} looks like the stronger pick right now.`,
      listingIds: ids,
    },
  });
  console.log("seeded assistant message with listingIds:", ids);
}
main().catch((e) => console.error(e)).finally(() => prisma.$disconnect());
