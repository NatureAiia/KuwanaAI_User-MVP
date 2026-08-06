import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const cols: any[] = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='auth' AND table_name='users' ORDER BY ordinal_position`
  );
  console.log("auth.users columns:");
  for (const c of cols) console.log(` ${c.column_name} | ${c.data_type} | nullable=${c.is_nullable} | default=${c.column_default}`);

  const idCols: any[] = await prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='auth' AND table_name='identities' ORDER BY ordinal_position`
  );
  console.log("\nauth.identities columns:");
  for (const c of idCols) console.log(` ${c.column_name} | ${c.data_type} | nullable=${c.is_nullable}`);

  const ext: any[] = await prisma.$queryRawUnsafe(`SELECT extname FROM pg_extension`);
  console.log("\nextensions:", ext.map((e:any)=>e.extname).join(", "));
}
main().finally(() => prisma.$disconnect());
