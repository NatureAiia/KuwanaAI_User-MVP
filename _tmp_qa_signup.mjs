import { chromium } from "playwright";

const SHOT_DIR = "/tmp/shots";
const BASE = "http://localhost:3000";
const EMAIL = `qa-provider-${Date.now()}@kuwana.local`;
const PASSWORD = "QaTest12345!";

async function shot(page, name) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true });
  console.log("screenshot:", name);
}

async function clickFirstUnpressedChip(page) {
  const chip = page.locator('button[aria-pressed="false"]').first();
  if (await chip.count()) {
    await chip.click();
    return true;
  }
  return false;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text());
  });
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await shot(page, "01-signup-role");

  // Role step: click "Consumer"
  await page.getByText("Consumer", { exact: true }).first().click();
  await page.waitForTimeout(300);
  await shot(page, "02-role-selected");

  // Some flows may auto-advance on role click, others need a Continue button
  const continueBtn = page.getByRole("button", { name: /continue/i });
  if (await continueBtn.count()) {
    await continueBtn.first().click();
  }
  await page.waitForTimeout(300);
  await shot(page, "03-account-step");

  // Account step: email + password
  await page.fill('input[type="email"]', EMAIL);
  const pwFields = page.locator('input[type="password"]');
  const pwCount = await pwFields.count();
  for (let i = 0; i < pwCount; i++) await pwFields.nth(i).fill(PASSWORD);
  await shot(page, "04-account-filled");
  await page.getByRole("button", { name: /continue/i }).first().click();
  await page.waitForTimeout(500);

  // Loop through chip-selection steps until we hit something without chips/continue
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300);
    const url = page.url();
    if (!url.includes("/signup")) break;

    await shot(page, `05-step-${i}`);

    // Click one chip per visible ChipGroup (there may be multiple groups per step)
    let clickedAny = false;
    const chips = page.locator('button[aria-pressed="false"]');
    const count = await chips.count();
    // click first chip of each group by re-querying after each click (selection may reveal new groups)
    if (count > 0) {
      await chips.first().click();
      clickedAny = true;
      await page.waitForTimeout(150);
    }

    // Try consent checkboxes too
    const checkboxes = page.locator('input[type="checkbox"]');
    const cbCount = await checkboxes.count();
    for (let c = 0; c < cbCount; c++) {
      const cb = checkboxes.nth(c);
      if (!(await cb.isChecked())) {
        await cb.check().catch(() => {});
      }
    }

    const btn = page.getByRole("button", { name: /continue|finish|create account|sign up|get started/i });
    if (await btn.count()) {
      await btn.first().click();
      await page.waitForTimeout(400);
    } else if (!clickedAny) {
      console.log("No chips or continue button found at step", i, "url:", url);
      break;
    }
  }

  await page.waitForTimeout(1500);
  await shot(page, "06-post-signup");
  console.log("final URL:", page.url());
  console.log("EMAIL_USED:", EMAIL);

  await browser.close();
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
