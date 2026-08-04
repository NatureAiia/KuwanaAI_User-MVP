import { describe, expect, it } from "vitest";
import { levelForXp, xpIntoLevel, XP_PER_LEVEL } from "@/lib/gamification/rules";

describe("levelForXp", () => {
  it("starts at level 1 with zero XP", () => {
    expect(levelForXp(0)).toBe(1);
  });

  it("stays on the same level until crossing the next XP_PER_LEVEL boundary", () => {
    expect(levelForXp(XP_PER_LEVEL - 1)).toBe(1);
    expect(levelForXp(XP_PER_LEVEL)).toBe(2);
    expect(levelForXp(XP_PER_LEVEL + 1)).toBe(2);
  });

  it("computes level for large XP totals", () => {
    expect(levelForXp(XP_PER_LEVEL * 5)).toBe(6);
  });
});

describe("xpIntoLevel", () => {
  it("is zero right at a level boundary", () => {
    expect(xpIntoLevel(0)).toBe(0);
    expect(xpIntoLevel(XP_PER_LEVEL)).toBe(0);
  });

  it("reports progress within the current level", () => {
    expect(xpIntoLevel(XP_PER_LEVEL + 30)).toBe(30);
  });
});
