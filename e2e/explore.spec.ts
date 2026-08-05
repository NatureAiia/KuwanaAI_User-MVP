import { test, expect } from "@playwright/test";

test("explore hub lists sectors and links into a live one", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();

  await page.getByRole("link", { name: /telecom/i }).click();
  // Next dev compiles routes on demand — under parallel test workers sharing
  // one dev server, the first hit on /explore/telecom can take a while past
  // Playwright's 5s default.
  await expect(page).toHaveURL(/\/explore\/telecom/, { timeout: 15_000 });
});

test("an unknown route renders the branded 404, not a framework default", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();

  await page.getByRole("link", { name: "Back to Explore" }).click();
  await expect(page).toHaveURL(/\/explore$/);
});
