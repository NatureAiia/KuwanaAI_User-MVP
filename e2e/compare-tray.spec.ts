import { test, expect } from "@playwright/test";

test("compare selection survives navigating into a listing and back", async ({ page }) => {
  await page.goto("/explore/telecom");
  await expect(page.getByRole("heading", { name: "Telecom" })).toBeVisible({ timeout: 15_000 });

  const addButtons = page.getByRole("button", { name: /^Add .+ to comparison$/ });
  await expect(addButtons.first()).toBeVisible({ timeout: 15_000 });
  await addButtons.nth(0).click();
  await addButtons.nth(1).click();

  const compareButton = page.getByRole("button", { name: "Compare", exact: true });
  await expect(compareButton).toBeVisible();
  await expect(compareButton).toBeEnabled();

  // Follow the first selected listing into its own detail page — previously
  // this unmounted the component holding the selection and lost it entirely.
  await page.getByRole("link", { name: "View details" }).first().click();
  await expect(page).toHaveURL(/\/listing\//);
  await expect(page.getByRole("button", { name: "Added to compare" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare", exact: true })).toBeEnabled();

  // Back on the grid, the same two listings should still show as selected.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Telecom" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Remove .+ from comparison$/ })).toHaveCount(2);

  // Unauthenticated: acting on the tray redirects to sign up rather than
  // silently failing or 500ing on the compare page.
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page).toHaveURL(/\/signup/);
});

test("removing a chip from the floating tray updates the count", async ({ page }) => {
  await page.goto("/explore/telecom");
  await expect(page.getByRole("heading", { name: "Telecom" })).toBeVisible({ timeout: 15_000 });

  const addButtons = page.getByRole("button", { name: /^Add .+ to comparison$/ });
  await expect(addButtons.first()).toBeVisible({ timeout: 15_000 });
  await addButtons.nth(0).click();
  await addButtons.nth(1).click();

  const compareButton = page.getByRole("button", { name: "Compare", exact: true });
  await expect(compareButton).toBeEnabled();

  await page.getByRole("button", { name: /^Deselect / }).first().click();
  await expect(compareButton).toBeDisabled();
});
