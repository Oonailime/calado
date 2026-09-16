import { chromium } from "@playwright/test";

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
    viewport: { width: 1024, height: 640 },
  });
  await page.goto(process.env.BENCHMARK_BASE_URL || "http://localhost:3000", {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const play = page.getByRole("button", { name: "Jogar ↗" });
  await play.waitFor({ state: "visible", timeout: 120_000 });
  await play.click();
  const game = page.getByRole("region", { name: "Ambiente jogável" });
  await game.waitFor({ state: "visible", timeout: 120_000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Ambiente jogável"]')
        ?.getAttribute("data-ready") === "true",
    undefined,
    { timeout: 120_000 },
  );

  async function sample(quality) {
    await page.getByRole("button", { name: "Pausa e configurações" }).click();
    await page.getByLabel("Qualidade gráfica").selectOption(quality);
    await page.getByRole("button", { name: "Retomar", exact: true }).click();
    // Let model uploads and shader compilation settle before comparing the
    // steady-state scene. A single first-second value mostly measures cache
    // warm-up, especially in software-rendered CI browsers.
    await page.waitForTimeout(6_000);
    const fpsSamples = [];
    for (let index = 0; index < 5; index += 1) {
      await page.waitForTimeout(1_100);
      fpsSamples.push(Number(await game.getAttribute("data-fps")));
    }
    fpsSamples.sort((a, b) => a - b);
    return {
      fps: fpsSamples[Math.floor(fpsSamples.length / 2)],
      fpsSamples,
      drawCalls: Number(await game.getAttribute("data-draw-calls")),
    };
  }

  const high = await sample("high");
  const ultra = await sample("ultra");
  const result = {
    high,
    ultra,
    fpsDeltaPercent: high.fps
      ? Number((((ultra.fps - high.fps) / high.fps) * 100).toFixed(1))
      : null,
    extraDrawCalls: ultra.drawCalls - high.drawCalls,
  };
  await page.screenshot({ path: "test-results/quality-ultra.png" });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
