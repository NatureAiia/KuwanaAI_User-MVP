import { test, expect } from "@playwright/test";

test("landing page renders and links to login/signup", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { name: /compare smarter/i })).toBeVisible();

  // The Content-Security-Policy header added in next.config.ts is the kind
  // of thing that fails silently (a blocked inline script just doesn't run,
  // no visible error) — a real browser console is the only way to catch it.
  const cspViolations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /content security policy/i.test(msg.text())) cspViolations.push(msg.text());
  });

  await page.getByRole("link", { name: "Log in" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  expect(cspViolations).toEqual([]);
});

test("signup link from the landing page reaches the signup wizard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Get started" }).first().click();
  await expect(page).toHaveURL(/\/signup/);
});
