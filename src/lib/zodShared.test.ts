import { describe, it, expect } from "vitest";
import { sectorEnum, boundedJsonRecord } from "./zodShared";
import { SECTORS } from "./sectors";
import { CLIENT_REPORTABLE_EVENTS } from "./gamification/clientEvents";

describe("sectorEnum", () => {
  it("accepts every sector defined in SECTORS", () => {
    for (const slug of Object.keys(SECTORS)) {
      expect(sectorEnum.safeParse(slug).success).toBe(true);
    }
  });

  it("accepts the sectors the hand-copied route enums had drifted past", () => {
    // These two went live but were never added to /api/events or
    // /api/footprint, so a real footprint in either was rejected as invalid.
    expect(sectorEnum.safeParse("electronics").success).toBe(true);
    expect(sectorEnum.safeParse("fashion").success).toBe(true);
  });

  it("rejects an unknown slug rather than passing it to a Postgres enum column", () => {
    expect(sectorEnum.safeParse("crypto").success).toBe(false);
    expect(sectorEnum.safeParse("").success).toBe(false);
  });
});

describe("boundedJsonRecord", () => {
  const schema = boundedJsonRecord(3, 100);

  it("accepts a payload inside both bounds", () => {
    expect(schema.safeParse({ a: 1, b: "two" }).success).toBe(true);
  });

  it("rejects too many keys", () => {
    expect(schema.safeParse({ a: 1, b: 2, c: 3, d: 4 }).success).toBe(false);
  });

  it("rejects a payload that is small in key count but large in bytes", () => {
    expect(schema.safeParse({ a: "x".repeat(500) }).success).toBe(false);
  });

  it("rejects an absurdly long key", () => {
    expect(schema.safeParse({ ["k".repeat(200)]: 1 }).success).toBe(false);
  });
});

describe("CLIENT_REPORTABLE_EVENTS", () => {
  it("excludes every event the server already records itself", () => {
    // Accepting these from a browser let any account mint XP, badges, and
    // leaderboard rank by replaying a POST — and duplicated the write the
    // real route already performs.
    const serverOwned = [
      "profile_completed",
      "comparison_completed",
      "item_saved",
      "recommendation_viewed",
      "chat_started",
    ];
    for (const eventType of serverOwned) {
      expect(CLIENT_REPORTABLE_EVENTS).not.toContain(eventType);
    }
  });

  it("still accepts the three signals only the client can observe", () => {
    expect(CLIENT_REPORTABLE_EVENTS).toContain("comparison_viewed");
    expect(CLIENT_REPORTABLE_EVENTS).toContain("action_taken");
    expect(CLIENT_REPORTABLE_EVENTS).toContain("daily_visit");
  });
});
