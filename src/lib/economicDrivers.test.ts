import { beforeEach, describe, expect, it, vi } from "vitest";

const economicDriverFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { economicDriver: { findMany: economicDriverFindMany } },
}));

const { getLatestEconomicDrivers } = await import("@/lib/economicDrivers");

beforeEach(() => {
  economicDriverFindMany.mockReset();
});

describe("getLatestEconomicDrivers", () => {
  it("queries the given region ordered by most recent period", async () => {
    economicDriverFindMany.mockResolvedValueOnce([]);
    await getLatestEconomicDrivers("ZW");

    expect(economicDriverFindMany).toHaveBeenCalledWith({
      where: { region: "ZW" },
      orderBy: { period: "desc" },
    });
  });

  it("keeps only the most recent period per driver name", async () => {
    economicDriverFindMany.mockResolvedValueOnce([
      {
        name: "USD_ZIG_RATE",
        region: "ZW",
        value: 30,
        previousValue: 28,
        period: new Date("2026-08-01"),
        currencyCode: "ZIG",
      },
      {
        name: "USD_ZIG_RATE",
        region: "ZW",
        value: 28,
        previousValue: 27,
        period: new Date("2026-07-01"),
        currencyCode: "ZIG",
      },
    ]);

    const result = await getLatestEconomicDrivers("ZW");

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(30);
    expect(result[0].period).toEqual(new Date("2026-08-01"));
  });

  it("computes changePercent from value vs previousValue", async () => {
    economicDriverFindMany.mockResolvedValueOnce([
      {
        name: "INFLATION_RATE",
        region: "ZW",
        value: 33,
        previousValue: 30,
        period: new Date("2026-08-01"),
        currencyCode: null,
      },
    ]);

    const result = await getLatestEconomicDrivers("ZW");

    expect(result[0].changePercent).toBe(10);
  });

  it("returns changePercent of null when previousValue is missing or zero", async () => {
    economicDriverFindMany.mockResolvedValueOnce([
      { name: "A", region: "ZW", value: 10, previousValue: null, period: new Date("2026-08-01"), currencyCode: null },
      { name: "B", region: "ZW", value: 10, previousValue: 0, period: new Date("2026-08-01"), currencyCode: null },
    ]);

    const result = await getLatestEconomicDrivers("ZW");

    expect(result.find((r) => r.name === "A")?.changePercent).toBeNull();
    expect(result.find((r) => r.name === "B")?.changePercent).toBeNull();
  });
});
