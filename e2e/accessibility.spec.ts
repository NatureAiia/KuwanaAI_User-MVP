import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Automated coverage of the WCAG 2.1 AA rules axe can check (contrast,
// labels, landmarks, aria misuse, etc.) across every page reachable without
// an authenticated session — same constraint as the rest of this suite (see
// auth-pages.spec.ts): there's no way to get a real session without a live
// inbox or the Supabase admin API. Portal pages behind login (dashboard,
// profile, admin, provider, corporate, regulator) need a manual pass with a
// real session; see docs/accessibility-audit.md.
const PUBLIC_PAGES = ["/", "/login", "/signup", "/trust", "/explore", "/explore/telecom", "/explore/healthcare"];

for (const theme of ["light", "dark"] as const) {
  for (const path of PUBLIC_PAGES) {
    test(`[${theme}] ${path} has no automatically detectable WCAG 2.1 AA violations`, async ({ page }) => {
      // The app's own inline theme-init script (layout.tsx) reads this key on
      // load and toggles the `dark` class before paint — setting it via
      // addInitScript (runs before any page script) is the same thing a real
      // returning dark-mode user's browser would do, without needing to click
      // the toggle and race the transition.
      if (theme === "dark") {
        await page.addInitScript(() => localStorage.setItem("kuwana-theme", "dark"));
      }
      await page.goto(path, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

      const violations = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.map((n) => n.target.join(" ")),
      }));
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
}

test("skip link jumps keyboard focus past the header to main content", async ({ page }) => {
  await page.goto("/explore/telecom");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});
