import { defineConfig, devices } from "@playwright/test";

// Unauthenticated-flow smoke tests only — there's no way to get a real,
// email-confirmed session without either a live inbox or the Supabase
// admin API (SUPABASE_SERVICE_ROLE_KEY is still a placeholder in .env, same
// as ANTHROPIC_API_KEY; see HANDOFF.md). Covers what a real browser can
// verify that curl/DB checks can't: pages actually render, navigate, and
// don't trip the CSP added in next.config.ts.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
