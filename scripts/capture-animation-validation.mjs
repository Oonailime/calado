import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const motions = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "biped-walk",
      "tree-climb",
      "tree-descend",
      "vine-swing",
      "vine-jump",
      "vine-grab",
    ];
const times = [0.12, 0.42, 0.78, 1.1, 1.45, 1.9, 2.6, 3.3];
const output = path.resolve("test-results/animations");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const report = {};
try {
  for (const motion of motions) {
    const sampleTimes =
      motion === "vine-grab"
        ? [0.3, 1.1, 1.425, 1.75, 3.4, 4.2, 4.525, 4.85]
        : times;
    const page = await browser.newPage({
      viewport: { width: 720, height: 720 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `${process.env.PREVIEW_BASE_URL || "http://localhost:3000"}/estudo/animacoes?motion=${motion}`,
      {
        waitUntil: "networkidle",
        timeout: 120000,
      },
    );
    await page
      .locator('[data-preview-ready="true"]')
      .waitFor({ timeout: 120000 });
    await page.waitForFunction(() =>
      Boolean(document.querySelector("canvas")?.dataset.rig),
    );
    await page.addStyleTag({ content: "figure { display: none !important; }" });
    await page.clock.install();
    await page.waitForTimeout(100);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.evaluate(() =>
      window.dispatchEvent(new Event("reset-animation-preview")),
    );
    await page.clock.runFor(16);
    let previous = 0;
    const frames = [];
    const tiles = [];
    for (const time of sampleTimes) {
      await page.clock.runFor(Math.round((time - previous) * 1000));
      previous = time;
      const canvas = page.locator("canvas");
      const file = path.join(output, `${motion}-${time.toFixed(2)}.png`);
      await canvas.screenshot({ path: file });
      const rig = await canvas.getAttribute("data-rig");
      if (!rig) throw new Error(`${motion}: rig telemetry missing`);
      frames.push({ time, ...JSON.parse(rig) });
      tiles.push(
        `<figure><img src="data:image/png;base64,${(await readFile(file)).toString("base64")}"><figcaption>${time.toFixed(2)} s</figcaption></figure>`,
      );
    }
    if (errors.length) throw new Error(errors.join("\n"));
    report[motion] = { errors, frames };
    await page.close();
    const sheet = await browser.newPage({
      viewport: { width: 1200, height: 700 },
    });
    await sheet.setContent(
      `<style>*{box-sizing:border-box}body{margin:0;background:#16362d;color:white;font:16px sans-serif}h1{font-size:22px;margin:16px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}figure{margin:0;position:relative}img{width:100%;display:block}figcaption{position:absolute;bottom:8px;left:10px;background:#16362dcc;padding:4px 8px}</style><h1>${motion}</h1><main>${tiles.join("")}</main>`,
    );
    await sheet.screenshot({
      path: path.join(output, `${motion}-contact-sheet.png`),
      fullPage: true,
    });
    await sheet.close();
    console.log(
      `validated ${motion}: ${times.length} frames, no browser errors`,
    );
  }
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
