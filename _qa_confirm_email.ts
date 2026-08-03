import { PrismaClient } from "@prisma/client";

const email = process.argv[2];
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$executeRawUnsafe(
    `UPDATE auth.users SET email_confirmed_at = now() WHERE email = $1 AND email_confirmed_at IS NULL`,
    email,
  );
  console.log("rows updated:", rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
