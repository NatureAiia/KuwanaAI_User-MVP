import { test, expect } from "@playwright/test";

// Auth moved from Supabase to Auth.js (Credentials + JWT, no email
// verification) — a full signup -> login -> protected-route -> logout round
// trip is now scriptable against a local Postgres, unlike under Supabase
// (which needed a live inbox or the admin API to get a confirmed session).
// Still no real submission here, though — that full round trip belongs in
// its own spec; this one only proves the forms render and validate.

test("login page has a working email/password form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  const submit = page.getByRole("button", { name: "Log in" });
  await expect(submit).toBeVisible();

  // Submitting with an unregistered email should surface a generic
  // credential-mismatch message (authorize() masks unknown-email and
  // wrong-password identically, see src/lib/nextAuth.ts), not a silent
  // failure or an unhandled exception.
  await page.getByLabel("Email").fill(`e2e-nonexistent-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("wrong-password-123");
  await submit.click();
  await expect(page.getByText(/don't match/i)).toBeVisible({ timeout: 10_000 });
});

test("login page links to signup", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup/);
});

test("signup wizard's first step renders", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "How will you use Kuwana?" })).toBeVisible();
});
