import { test, expect } from "@playwright/test";

// No real login/signup submission here — there's no way to get an
// email-confirmed session without a live inbox or the Supabase admin API
// (SUPABASE_SERVICE_ROLE_KEY is a placeholder in .env, same as
// ANTHROPIC_API_KEY). This only proves the forms render and validate.

test("login page has a working email/password form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  const submit = page.getByRole("button", { name: "Log in" });
  await expect(submit).toBeVisible();

  // Submitting with an unregistered email should surface Supabase's own
  // error message, not a silent failure or an unhandled exception.
  await page.getByLabel("Email").fill(`e2e-nonexistent-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("wrong-password-123");
  await submit.click();
  await expect(page.getByText(/invalid|not found|incorrect/i)).toBeVisible({ timeout: 10_000 });
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
