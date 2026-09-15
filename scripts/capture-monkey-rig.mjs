import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

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
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto(
    `${process.argv[2] || process.env.PREVIEW_BASE_URL || "http://localhost:3000"}/estudo/rig-macaco`,
    { waitUntil: "networkidle", timeout: 120_000 },
  );
  await page
    .locator('section[aria-label="Rig anatômico do macaco"] canvas')
    .waitFor({
      state: "visible",
      timeout: 120_000,
    });
  await page.getByRole("button", { name: "Pausar rotação" }).click();
  await page.waitForTimeout(500);
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/monkey-rig.png",
    fullPage: true,
  });
} finally {
  await browser.close();
}
