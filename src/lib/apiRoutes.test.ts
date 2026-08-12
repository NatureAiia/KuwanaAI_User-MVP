import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { GET as healthGET } from "@/app/api/health/route";
import { GET as fxReadyGET } from "@/app/api/health/ready/route";

describe("API Routes (functional)", () => {
  describe("GET /api/health", () => {
    it("returns JSON with expected structure", async () => {
      const response = (await healthGET()) as NextResponse;
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("service");
      expect(body).toHaveProperty("version");
      expect(body).toHaveProperty("uptimeSeconds");
      expect(typeof body.uptimeSeconds).toBe("number");
    });

    it("sets Cache-Control: no-store header", async () => {
      const response = (await healthGET()) as NextResponse;
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  describe("GET /api/health/ready", () => {
    it("returns a response even when database is unavailable", async () => {
      const response = (await fxReadyGET()) as NextResponse;
      // The route should return a response, possibly with error status
      expect([200, 503]).toContain(response.status);
    });
  });
});