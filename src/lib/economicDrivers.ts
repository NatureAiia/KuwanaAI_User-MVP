import { prisma } from "@/lib/prisma";

export type EconomicDriverSummary = {
  name: string;
  region: string;
  value: number;
  previousValue: number | null;
  period: Date;
  currencyCode: string | null;
  changePercent: number | null;
};

/**
 * The most recent reading per driver name in a region — context for pricing
 * dashboards (FX rate, inflation, fuel price, etc.), never used to convert or
 * adjust a listing's price. A region can carry several driver names at once;
 * this returns one row per name, whichever period is latest.
 */
export async function getLatestEconomicDrivers(region = "ZW"): Promise<EconomicDriverSummary[]> {
  const rows = await prisma.economicDriver.findMany({
    where: { region },
    orderBy: { period: "desc" },
  });

  const latestByName = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByName.has(row.name)) latestByName.set(row.name, row);
  }

  return [...latestByName.values()].map((row) => {
    const value = Number(row.value);
    const previousValue = row.previousValue !== null ? Number(row.previousValue) : null;
    const changePercent =
      previousValue !== null && previousValue !== 0
        ? Math.round(((value - previousValue) / Math.abs(previousValue)) * 10000) / 100
        : null;

    return {
      name: row.name,
      region: row.region,
      value,
      previousValue,
      period: row.period,
      currencyCode: row.currencyCode,
      changePercent,
    };
  });
}
