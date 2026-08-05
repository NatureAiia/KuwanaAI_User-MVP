import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 20000 });
await page.screenshot({ path: 'C:/Users/markn/AppData/Local/Temp/claude/d--Aiia-CodeHub-Kuwana-KuwanaAI-User-MVP/99693b0d-48d0-4c23-b837-fa334c5f74e9/scratchpad/home.png' });
await browser.close();
