import { test, expect } from "@playwright/test";

test("explore hub lists sectors and links into a live one", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: "Explore" })).toBeVisible();

  await page.getByRole("link", { name: /telecom/i }).click();
  await expect(page).toHaveURL(/\/explore\/telecom/, { timeout: 15_000 });
});

test("skip link jumps keyboard focus past the header to main content", async ({ page }) => {
  await page.goto("/explore/telecom");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});