import { chromium } from "@playwright/test";
const shotDir = "C:/Users/markn/AppData/Local/Temp/claude/d--Aiia-CodeHub-Kuwana-KuwanaAI-User-MVP/16db7162-0c41-4191-be8b-1cbd7c20622a/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3000/explore/telecom", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /dark mode/i }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${shotDir}/explore-telecom-dark.png` });

// listing detail
await page.getByRole("link", { name: "View details" }).first().click();
await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${shotDir}/listing-detail-dark.png`, fullPage: true });

await browser.close();
