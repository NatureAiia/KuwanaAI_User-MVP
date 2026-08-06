import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("response", (r) => { if (r.status() === 401) console.log("401:", r.request().method(), r.url()); });
await page.goto("http://localhost:3000/explore/telecom", { waitUntil: "networkidle" });
await browser.close();
