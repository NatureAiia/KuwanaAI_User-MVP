import { test, expect } from "@playwright/test";

// Shares the same constraint as auth-pages.spec.s: no real session without
// Supabase admin API. Only tests unauthenticated flows that the browser can verify.

test("landing page loads and get started link reaches signup", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /compare smarter/i })).toBeVisible();

  await page.getByRole("link", { name: "Get started" }).first().click();
  await expect(page).toHaveURL(/\/signup/);
});

test("explore hub lists sectors and links into a live one", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();

  await page.getByRole("link", { name: /telecom/i }).click();
  await expect(page).toHaveURL(/\/explore\/telecom/, { timeout: 15_000 });
});

test("unknown route renders 404", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();

  await page.getByRole("link", { name: "Browse comparisons" }).click();
  await expect(page).toHaveURL(/\/explore$/);
});

test("provider can view a listing detail from explore", async ({ page }) => {
  await page.goto("/explore/telecom");
  await expect(page.getByRole("heading", { name: "Telecom" })).toBeVisible({ timeout: 15_000 });

  const firstListing = page.getByRole("link", { name: "View details" }).first();
  await expect(firstListing).toBeVisible({ timeout: 15_000 });
  await firstListing.click();
  await expect(page).toHaveURL(/\/listing\//);
});

test("skip link jumps focus to main content", async ({ page }) => {
  await page.goto("/explore/telecom");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});