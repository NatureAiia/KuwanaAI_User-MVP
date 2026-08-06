import { chromium } from "playwright";

const results = [];

async function record(page, label, action) {
  await page.evaluate(() => {
    window.__events = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__events.push({ name: e.name, duration: e.duration, startTime: e.startTime });
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 0 });
  });
  await action();
  await page.waitForTimeout(300); // let the event-timing entry actually land
  const events = await page.evaluate(() => window.__events ?? []);
  const worst = events.sort((a, b) => b.duration - a.duration)[0];
  results.push({ label, worst, allCount: events.length });
  console.log(`${label}: ${events.length} events, worst = ${worst ? worst.duration + "ms (" + worst.name + ")" : "none"}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const client = await page.context().newCDPSession(page);

// 4x CPU slowdown ~ approximates a mid/low-range Android relative to a dev
// machine; "Slow 4G" network preset (Chrome DevTools' own numbers).
await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await client.send("Network.emulateNetworkConditions", {
  offline: false,
  downloadThroughput: (400 * 1024) / 8,
  uploadThroughput: (400 * 1024) / 8,
  latency: 400,
});

await page.goto("http://localhost:3000/explore/telecom", { timeout: 30000 });
await page.getByRole("heading", { name: "Telecom" }).waitFor({ timeout: 30000 });
await page.getByRole("button", { name: /^Add .+ to comparison$/ }).first().waitFor({ timeout: 30000 });

await record(page, "Add to compare (grid card toggle)", async () => {
  await page.getByRole("button", { name: /^Add .+ to comparison$/ }).first().click();
});

await record(page, "Sort toggle (Best value -> Price asc)", async () => {
  await page.getByRole("button", { name: /Best value|Price:/ }).click();
});

await record(page, "Category tab switch", async () => {
  await page.getByRole("button", { name: "Voice & SMS bundles" }).click();
  await page.waitForTimeout(50);
});

// Fresh page + fresh tray for the compare-page tests, so leftover sort/tray
// state from the tests above (which reorders the grid) can't put the wrong
// listing under an index-based locator.
const page2 = await browser.newPage();
const client2 = await page2.context().newCDPSession(page2);
await client2.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await client2.send("Network.emulateNetworkConditions", {
  offline: false,
  downloadThroughput: (400 * 1024) / 8,
  uploadThroughput: (400 * 1024) / 8,
  latency: 400,
});
await page2.goto("http://localhost:3000/explore/telecom", { timeout: 30000 });
await page2.getByRole("heading", { name: "Telecom" }).waitFor({ timeout: 30000 });
const addButtons2 = page2.getByRole("button", { name: /^Add .+ to comparison$/ });
await addButtons2.first().waitFor({ timeout: 30000 });
await addButtons2.nth(0).click();
await addButtons2.nth(1).click();
await page2.getByRole("button", { name: "Compare", exact: true }).click();
await page2.getByRole("heading", { name: /^Compare/ }).waitFor({ timeout: 30000 });

await record(page2, "Save toggle on compare table row", async () => {
  await page2.getByRole("button", { name: /^Save$/ }).first().click();
});

await record(page2, "Get AI recommendation click (sync portion only)", async () => {
  await page2.getByRole("button", { name: "Get AI recommendation" }).click();
});

console.log("\n--- Summary (Core Web Vitals: good <=200ms, needs-improvement <=500ms) ---");
for (const r of results) {
  const ms = r.worst?.duration ?? 0;
  const verdict = ms <= 200 ? "GOOD" : ms <= 500 ? "NEEDS IMPROVEMENT" : "POOR";
  console.log(`${r.label}: ${ms}ms — ${verdict}`);
}

await browser.close();
