import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args:
    process.env.PHASE_TWO_SOFTWARE === "1"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : [],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(
    process.env.PHASE_TWO_BASE_URL || "http://localhost:3000/?map=phase2",
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  const region = page.getByRole("region", { name: "Ambiente jogável" });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-map="phase2"]');
      return el?.getAttribute("data-grounded") === "true";
    },
    undefined,
    { timeout: 120000 },
  );
  await page.waitForTimeout(2500);
  const read = () =>
    region.evaluate((el) =>
      Object.fromEntries(
        [...el.attributes]
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => [a.name, a.value]),
      ),
    );
  const spawn = await read();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/phase2-spawn.png" });
  const renderer = await page
    .locator('[data-map="phase2"] canvas')
    .evaluate((canvas) => {
      const gl = canvas.getContext("webgl2");
      const info = gl?.getExtension("WEBGL_debug_renderer_info");
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
    });
  console.log(JSON.stringify({ renderer, spawn }));
  if (!process.argv.includes("--visual-only")) {
    const start = spawn["data-position"].split(",").map(Number);
    await page.keyboard.down("Space");
    await page.waitForFunction(
      (y) =>
        Number(
          document
            .querySelector('[data-map="phase2"]')
            ?.getAttribute("data-position")
            ?.split(",")[1],
        ) >
        y + 0.12,
      start[1],
      { timeout: 15000 },
    );
    await page.keyboard.up("Space");
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-map="phase2"]')
          ?.getAttribute("data-grounded") === "true",
    );
    await page.keyboard.down("w");
    await page.waitForFunction(
      (z) =>
        Number(
          document
            .querySelector('[data-map="phase2"]')
            ?.getAttribute("data-position")
            ?.split(",")[2],
        ) <
        z - 2,
      start[2],
      { timeout: 30000 },
    );
    await page.keyboard.up("w");
    await page.waitForTimeout(500);
    const walk = await read();
    await page.screenshot({ path: "test-results/phase2-chess.png" });
    await page.keyboard.press("r");
    await page.waitForTimeout(1500);
    const reset = await read();
    const resetPosition = reset["data-position"].split(",").map(Number);
    assert.ok(
      Math.hypot(resetPosition[0] - start[0], resetPosition[2] - start[2]) <
        0.4,
      "Reset must return to the phase2 clearing",
    );
    for (const key of ["2", "3", "1"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(300);
      assert.equal((await read())["data-map"], "phase2");
    }
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: /continuar|retomar|resume/i })
      .first()
      .click();
    await writeFile(
      "test-results/phase2-browser.json",
      JSON.stringify({ spawn, walk, reset, errors }, null, 2),
    );
    assert.deepEqual(
      errors,
      [],
      "Browser and WebGL must render without errors",
    );
    console.log(JSON.stringify({ spawn, walk, reset, errors }, null, 2));
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
