import { beforeEach, describe, expect, it, vi } from "vitest";

const listingFindMany = vi.fn();
const listingInvestigationFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { listing: { findMany: listingFindMany }, listingInvestigation: { findMany: listingInvestigationFindMany } },
}));

const { getProviderScorecards } = await import("@/lib/complianceScorecard");

function d(dateStr: string): Date {
  return new Date(dateStr);
}

beforeEach(() => {
  listingFindMany.mockReset();
  listingInvestigationFindMany.mockReset();
});

describe("getProviderScorecards", () => {
  it("counts published and rejected listings per provider", async () => {
    listingFindMany.mockResolvedValueOnce([
      { providerId: "p1", status: "published", provider: { name: "Econet", verified: true } },
      { providerId: "p1", status: "published", provider: { name: "Econet", verified: true } },
      { providerId: "p1", status: "rejected", provider: { name: "Econet", verified: true } },
    ]);
    listingInvestigationFindMany.mockResolvedValueOnce([]);

    const [scorecard] = await getProviderScorecards();
    expect(scorecard.publishedListingCount).toBe(2);
    expect(scorecard.rejectedListingCount).toBe(1);
    expect(scorecard.verified).toBe(true);
  });

  it("drops an investigation whose provider never appeared in the listings query", async () => {
    listingFindMany.mockResolvedValueOnce([
      { providerId: "p1", status: "published", provider: { name: "Econet", verified: true } },
    ]);
    listingInvestigationFindMany.mockResolvedValueOnce([
      { providerId: "orphan-provider", status: "open", outcome: "none", createdAt: d("2026-01-01"), resolvedAt: null },
    ]);

    const scorecards = await getProviderScorecards();
    expect(scorecards).toHaveLength(1);
    expect(scorecards[0].providerId).toBe("p1");
  });

  it("tallies case status and enforcement outcome counts", async () => {
    listingFindMany.mockResolvedValueOnce([
      { providerId: "p1", status: "published", provider: { name: "Econet", verified: true } },
    ]);
    listingInvestigationFindMany.mockResolvedValueOnce([
      { providerId: "p1", status: "open", outcome: "none", createdAt: d("2026-01-01"), resolvedAt: null },
      { providerId: "p1", status: "in_progress", outcome: "none", createdAt: d("2026-01-01"), resolvedAt: null },
      { providerId: "p1", status: "resolved", outcome: "fine", createdAt: d("2026-01-01"), resolvedAt: d("2026-01-05") },
      { providerId: "p1", status: "dismissed", outcome: "none", createdAt: d("2026-01-01"), resolvedAt: d("2026-01-02") },
    ]);

    const [scorecard] = await getProviderScorecards();
    expect(scorecard.openCases).toBe(1);
    expect(scorecard.inProgressCases).toBe(1);
    expect(scorecard.resolvedCases).toBe(1);
    expect(scorecard.dismissedCases).toBe(1);
    expect(scorecard.fineCount).toBe(1);
    expect(scorecard.warningCount).toBe(0);
    expect(scorecard.suspensionCount).toBe(0);
  });

  it("averages resolution days across every closed case (resolved or dismissed)", async () => {
    listingFindMany.mockResolvedValueOnce([
      { providerId: "p1", status: "published", provider: { name: "Econet", verified: true } },
    ]);
    listingInvestigationFindMany.mockResolvedValueOnce([
      { providerId: "p1", status: "resolved", outcome: "none", createdAt: d("2026-01-01"), resolvedAt: d("2026-01-03") },
      { providerId: "p1", status: "dismissed", outcome: "none", createdAt: d("2026-01-01"), resolvedAt: d("2026-01-07") },
    ]);

    const [scorecard] = await getProviderScorecards();
    // 2 days + 6 days, averaged.
    expect(scorecard.avgResolutionDays).toBe(4);
  });

  it("leaves avgResolutionDays null when nothing has closed yet", async () => {
    listingFindMany.mockResolvedValueOnce([
      { providerId: "p1", status: "published", provider: { name: "Econet", verified: true } },
    ]);
    listingInvestigationFindMany.mockResolvedValueOnce([
      { providerId: "p1", status: "open", outcome: "none", createdAt: d("2026-01-01"), resolvedAt: null },
    ]);

    const [scorecard] = await getProviderScorecards();
    expect(scorecard.avgResolutionDays).toBeNull();
  });

  it("ranks providers with the most active cases first, then the most rejected listings", async () => {
    listingFindMany.mockResolvedValueOnce([
      { providerId: "quiet", status: "published", provider: { name: "Quiet Co", verified: true } },
      { providerId: "busy", status: "published", provider: { name: "Busy Co", verified: true } },
      { providerId: "rejected-only", status: "rejected", provider: { name: "Rejected Co", verified: true } },
    ]);
    listingInvestigationFindMany.mockResolvedValueOnce([
      { providerId: "busy", status: "open", outcome: "none", createdAt: d("2026-01-01"), resolvedAt: null },
      { providerId: "busy", status: "in_progress", outcome: "none", createdAt: d("2026-01-01"), resolvedAt: null },
    ]);

    const scorecards = await getProviderScorecards();
    expect(scorecards.map((s) => s.providerId)).toEqual(["busy", "rejected-only", "quiet"]);
  });
});
