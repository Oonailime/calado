import { chromium } from "playwright";

const shots = "C:/Users/T-GAMER/AppData/Local/Temp/claude/c--Users-T-GAMER-Desktop-aleatorio-curriculo-emiliano-history-history/ec072862-f1ea-4fa4-be5a-dbac9fb9cc18/scratchpad";

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(err.message));

await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const total = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

async function shot(p, name, wait = 1000) {
  const y = Math.round(p * total);
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${shots}/${name}.png` });
}
async function clip(p, name, region, wait = 1000) {
  const y = Math.round(p * total);
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${shots}/${name}.png`, clip: region });
}

// Points 1+2+9: door + entering the house, close-up on school house
await clip(0.09, "f-door-far", { x: 350, y: 100, width: 600, height: 500 });
await clip(0.125, "f-door-arrived", { x: 350, y: 100, width: 600, height: 500 });
await clip(0.16, "f-door-left", { x: 350, y: 100, width: 600, height: 500 });

// Point 5+7: signage on the side wall, wide shot
await shot(0.35, "f-signage-wide");

// Point 3+4: rock path embedding + gaps, wide shot
await shot(0.5, "f-path-wide");

// Point 8: grass
await shot(0.02, "f-grass-close", 1200);

// Point 6: language switch
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(600);
await page.getByRole("button", { name: "English", exact: true }).click();
await page.waitForTimeout(400);
await shot(0.35, "f-signage-english");

await browser.close();
console.log("ERRORS:", JSON.stringify(errors));
