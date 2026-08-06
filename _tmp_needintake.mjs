import { chromium } from "@playwright/test";
const shotDir = "C:/Users/markn/AppData/Local/Temp/claude/d--Aiia-CodeHub-Kuwana-KuwanaAI-User-MVP/16db7162-0c41-4191-be8b-1cbd7c20622a/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type()==="error") errors.push(m.text()); });

await page.goto("http://localhost:3000/explore", { waitUntil: "networkidle" });
await page.getByPlaceholder(/What do you need/).fill("a cheap data bundle");
const start = Date.now();
const [resp] = await Promise.all([
  page.waitForResponse((r) => r.url().includes("/api/need-intake")),
  page.getByRole("button", { name: "Search" }).click(),
]);
console.log("status:", resp.status(), "ms:", Date.now() - start);
console.log("body:", await resp.text());
await page.waitForTimeout(1500);
console.log("URL:", page.url());
await page.screenshot({ path: `${shotDir}/need-intake-result.png` });
console.log("errors:", JSON.stringify(errors));
await browser.close();
