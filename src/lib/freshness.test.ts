import { describe, expect, it } from "vitest";
import { computeFreshnessStatus, FRESH_WITHIN_DAYS, STALE_WITHIN_DAYS } from "@/lib/freshness";

const DAY_MS = 86_400_000;
const now = new Date("2026-01-15T00:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

describe("computeFreshnessStatus", () => {
  it("is fresh right at verification time", () => {
    expect(computeFreshnessStatus(now, now)).toBe("fresh");
  });

  it("is fresh exactly at the FRESH_WITHIN_DAYS boundary", () => {
    expect(computeFreshnessStatus(daysAgo(FRESH_WITHIN_DAYS), now)).toBe("fresh");
  });

  it("becomes stale one day past the fresh boundary", () => {
    expect(computeFreshnessStatus(daysAgo(FRESH_WITHIN_DAYS + 1), now)).toBe("stale");
  });

  it("is stale exactly at the STALE_WITHIN_DAYS boundary", () => {
    expect(computeFreshnessStatus(daysAgo(STALE_WITHIN_DAYS), now)).toBe("stale");
  });

  it("becomes unverified one day past the stale boundary", () => {
    expect(computeFreshnessStatus(daysAgo(STALE_WITHIN_DAYS + 1), now)).toBe("unverified");
  });

  it("stays unverified far beyond the stale boundary", () => {
    expect(computeFreshnessStatus(daysAgo(365), now)).toBe("unverified");
  });

  it("defaults `now` to the current time when not passed explicitly", () => {
    expect(computeFreshnessStatus(new Date())).toBe("fresh");
  });
});
