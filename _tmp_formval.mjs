import { chromium } from "@playwright/test";
const shotDir = "C:/Users/markn/AppData/Local/Temp/claude/d--Aiia-CodeHub-Kuwana-KuwanaAI-User-MVP/16db7162-0c41-4191-be8b-1cbd7c20622a/scratchpad";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// Login with bad credentials
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.getByLabel("Email").fill("not-a-real-user@example.com");
await page.getByLabel("Password").fill("wrongpassword123");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${shotDir}/login-bad-creds.png` });
console.log("login url after bad creds:", page.url());

// Login with malformed email (client validation)
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.getByLabel("Email").fill("not-an-email");
await page.getByLabel("Password").fill("x");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${shotDir}/login-invalid-email.png` });

console.log("errors:", JSON.stringify(errors));
await browser.close();
