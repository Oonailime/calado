import { chromium } from "playwright";

const shots = "C:/Users/T-GAMER/AppData/Local/Temp/claude/c--Users-T-GAMER-Desktop-aleatorio-curriculo-emiliano-history-history/ec072862-f1ea-4fa4-be5a-dbac9fb9cc18/scratchpad";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

async function clip(p, name, region, wait = 1000) {
  const y = Math.round(p * total);
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${shots}/${name}.png`, clip: region });
}

// Very tight crop right on the school house's front-facing wall.
await clip(0.113, "door2-close-a", { x: 500, y: 220, width: 300, height: 260 });
await clip(0.125, "door2-close-b", { x: 500, y: 220, width: 300, height: 260 });
await clip(0.137, "door2-close-c", { x: 500, y: 220, width: 300, height: 260 });

await browser.close();
