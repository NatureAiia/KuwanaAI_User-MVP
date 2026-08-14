import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/adminAudit";
import { privateJson } from "@/lib/apiResponse";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  region: z.string().trim().min(1).max(10).default("ZW"),
  value: z.coerce.number(),
  previousValue: z.coerce.number().optional(),
  period: z.coerce.date(),
  currencyCode: z.string().trim().min(1).max(10).optional(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const economicDrivers = await prisma.economicDriver.findMany({ orderBy: [{ name: "asc" }, { period: "desc" }] });
  return privateJson({ economicDrivers });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return privateJson({ error: "Not authorised" }, { status: 403 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const economicDriver = await prisma.economicDriver.upsert({
    where: { name_region_period: { name: data.name, region: data.region, period: data.period } },
    update: {
      value: data.value,
      previousValue: data.previousValue ?? null,
      currencyCode: data.currencyCode ?? null,
      updatedByEmail: admin.email,
    },
    create: {
      name: data.name,
      region: data.region,
      value: data.value,
      previousValue: data.previousValue ?? null,
      period: data.period,
      currencyCode: data.currencyCode ?? null,
      updatedByEmail: admin.email,
    },
  });

  await logAdminAction({
    adminEmail: admin.email,
    action: "economic_driver_upserted",
    targetType: "economic_driver",
    targetId: economicDriver.id,
    detail: `${economicDriver.name} (${economicDriver.region}): ${data.value} @ ${data.period.toISOString().slice(0, 10)}`,
  });

  return privateJson({ economicDriver });
}
