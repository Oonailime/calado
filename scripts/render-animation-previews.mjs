import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const catalogue = [
  ["biped-walk", "macaco-andando-bipede.webm", 4],
  ["tree-climb", "macaco-escalando-arvore.webm", 4],
  ["tree-descend", "macaco-descendo-arvore.webm", 4],
  ["vine-swing", "macaco-balancando-cipo.webm", 5],
  ["vine-jump", "macaco-pulando-cipo.webm", 4],
  ["vine-grab", "macaco-agarrando-cipo.webm", 6.2],
];
const requestedMotion = process.argv[2] || process.env.PREVIEW_MOTION;
const previews = requestedMotion
  ? catalogue.filter(([motion]) => motion === requestedMotion)
  : catalogue;
if (!previews.length) throw new Error(`Unknown animation: ${requestedMotion}`);
const baseURL = process.env.PREVIEW_BASE_URL || "http://localhost:3000";
const outputDirectory = path.resolve("public/assets/previews/animations");
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
try {
  for (const [motion, file, duration] of previews) {
    const context = await browser.newContext({
      viewport: { width: 720, height: 720 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    await page.goto(`${baseURL}/estudo/animacoes?motion=${motion}`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    await page.locator('[data-preview-ready="true"]').waitFor({
      timeout: 120_000,
    });
    await page.evaluate(() =>
      window.dispatchEvent(new Event("reset-animation-preview")),
    );
    await page.waitForTimeout(100);
    const downloadPromise = page.waitForEvent("download", {
      timeout: duration * 1_000 + 30_000,
    });
    await page.evaluate(
      ({ captureDuration, downloadName }) =>
        new Promise((resolve, reject) => {
          const canvas = document.querySelector("canvas");
          if (!(canvas instanceof HTMLCanvasElement)) {
            reject(new Error("Preview canvas was not found"));
            return;
          }
          const recorder = new MediaRecorder(canvas.captureStream(25), {
            mimeType: "video/webm;codecs=vp8",
            videoBitsPerSecond: 2_800_000,
          });
          const chunks = [];
          recorder.ondataavailable = (event) => chunks.push(event.data);
          recorder.onerror = () => reject(new Error("MediaRecorder failed"));
          recorder.onstop = () => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(
              new Blob(chunks, { type: "video/webm" }),
            );
            link.download = downloadName;
            link.click();
            resolve();
          };
          recorder.start(200);
          window.setTimeout(() => recorder.stop(), captureDuration * 1_000);
        }),
      { captureDuration: duration, downloadName: file },
    );
    const download = await downloadPromise;
    await download.saveAs(path.join(outputDirectory, file));
    await context.close();
    process.stdout.write(`rendered ${file}\n`);
  }
} finally {
  await browser.close();
}
