import { NextResponse } from "next/server";

/**
 * Liveness probe.
 *
 * Deliberately checks nothing but "this process can serve a request". A
 * liveness probe that touches the database restarts every pod in the cluster
 * the moment Postgres has a bad minute, turning a recoverable dependency
 * outage into a full outage plus a crash loop. Dependency health belongs in
 * `/api/health/ready`, which only removes a pod from the Service.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  const response = NextResponse.json({
    status: "ok",
    service: "kuwana-web",
    version: process.env.APP_VERSION ?? "dev",
    uptimeSeconds: Math.round(process.uptime()),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
