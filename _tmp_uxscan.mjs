import { chromium } from "@playwright/test";
import fs from "fs";

const shotDir = "C:\\Users\\markn\\AppData\\Local\\Temp\\claude\\d--Aiia-CodeHub-Kuwana-KuwanaAI-User-MVP\\16db7162-0c41-4191-be8b-1cbd7c20622a\\scratchpad";
const shot = (n) => `${shotDir}\\${n}.png`;

const browser = await chromium.launch();
const results = {};

async function visit(name, path, viewport, opts = {}) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  const start = Date.now();
  const resp = await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle", timeout: 20000 }).catch((e) => ({ __err: String(e) }));
  const loadMs = Date.now() - start;
  if (opts.action) await opts.action(page).catch((e) => errors.push("ACTION_FAIL: " + e.message));
  await page.screenshot({ path: shot(name), fullPage: true }).catch(() => {});
  results[name] = {
    status: resp?.status ? resp.status() : resp?.__err,
    loadMs,
    errors,
  };
  await page.close();
}

await visit("landing-mobile", "/", { width: 390, height: 844 });
await visit("landing-desktop", "/", { width: 1440, height: 900 });
await visit("login-mobile", "/login", { width: 390, height: 844 });
await visit("signup-mobile", "/signup", { width: 390, height: 844 });
await visit("explore-hub-mobile", "/explore", { width: 390, height: 844 });
await visit("explore-telecom-mobile", "/explore/telecom", { width: 390, height: 844 });
await visit("explore-telecom-desktop", "/explore/telecom", { width: 1440, height: 900 });
await visit("notfound-mobile", "/this-route-does-not-exist", { width: 390, height: 844 });
await visit("provider-portal-mobile", "/provider", { width: 390, height: 844 });
await visit("dashboard-mobile", "/dashboard", { width: 390, height: 844 });
await visit("chat-mobile", "/chat", { width: 390, height: 844 });

fs.writeFileSync(shot("results.json").replace(".png", ".json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

await browser.close();
