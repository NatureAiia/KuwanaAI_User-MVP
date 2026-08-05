import { describe, expect, it } from "vitest";
import { isNavItemActive } from "@/lib/nav";

describe("isNavItemActive", () => {
  it("matches an exact pathname", () => {
    expect(isNavItemActive("/explore", "/explore")).toBe(true);
  });

  it("matches a sub-route by prefix for a non-dashboard item", () => {
    expect(isNavItemActive("/explore/telecom", "/explore")).toBe(true);
  });

  it("does not prefix-match an unrelated route", () => {
    expect(isNavItemActive("/profile", "/explore")).toBe(false);
  });

  it("requires an exact match for the dashboard item — no prefix matching", () => {
    // Otherwise every route in the app (all mounted under some path) would
    // risk highlighting "Home" as active alongside whatever's actually active.
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard/something", "/dashboard")).toBe(false);
  });

  it("returns false for a null pathname", () => {
    expect(isNavItemActive(null, "/explore")).toBe(false);
  });
});
