import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: [
    ...(process.env.PHASE_FOUR_SOFTWARE === "1"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : []),
    "--disable-dev-shm-usage",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    process.env.PHASE_FOUR_BASE_URL || "http://localhost:3000/?map=phase4",
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  const region = page.getByRole("region", { name: "Ambiente jogável" });
  await region.waitFor({ state: "visible", timeout: 120000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[aria-label="Ambiente jogável"]');
      return (
        el?.getAttribute("data-map") === "phase4" &&
        el.getAttribute("data-grounded") === "true" &&
        el.hasAttribute("data-position")
      );
    },
    undefined,
    { timeout: 120000 },
  );
  await page.waitForTimeout(1800);
  await page.keyboard.press("1");
  await page.waitForFunction(
    () =>
      document
        .querySelector('[aria-label="Ambiente jogável"]')
        ?.getAttribute("data-selected") === "1",
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/phase4-spawn.png" });
  const read = () =>
    region.evaluate((el) =>
      Object.fromEntries(
        [...el.attributes]
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => [a.name, a.value]),
      ),
    );
  const spawn = await read();
  process.stdout.write(`Spawn: ${JSON.stringify(spawn)}\n`);
  if (process.argv.includes("--visual-only")) {
    await page.locator("canvas").last().dispatchEvent("mousemove", {
      buttons: 1,
      movementX: 320,
      movementY: 180,
    });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: "test-results/phase4-ground.png" });
    await writeFile(
      "test-results/phase4-visual.json",
      `${JSON.stringify({ spawn, errors }, null, 2)}\n`,
    );
    if (errors.length) throw new Error(errors.join("\n"));
  } else {
    await page.keyboard.down("w");
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[aria-label="Ambiente jogável"]');
        const p = el?.getAttribute("data-position")?.split(",").map(Number);
        return p && p[2] < 7;
      },
      undefined,
      { timeout: 90000 },
    );
    await page.keyboard.up("w");
    const walk = await read();
    await page.screenshot({ path: "test-results/phase4-branch.png" });
    await page.keyboard.press("Space");
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Ambiente jogável"]')
          ?.getAttribute("data-grounded") === "false",
      undefined,
      { timeout: 10000 },
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Ambiente jogável"]')
          ?.getAttribute("data-grounded") === "true",
      undefined,
      { timeout: 30000 },
    );
    const landed = await read();
    await page.keyboard.press("r");
    await page.waitForFunction(
      () => {
        const p = document
          .querySelector('[aria-label="Ambiente jogável"]')
          ?.getAttribute("data-position")
          ?.split(",")
          .map(Number);
        return p && Math.abs(p[0] + 13) < 0.2 && Math.abs(p[2] - 14) < 0.2;
      },
      undefined,
      { timeout: 30000 },
    );
    const reset = await read();
    await page.keyboard.down("w");
    await page.waitForFunction(
      () =>
        Number(
          document
            .querySelector('[aria-label="Ambiente jogável"]')
            ?.getAttribute("data-position")
            ?.split(",")[2],
        ) < 12.4,
      undefined,
      { timeout: 30000 },
    );
    await page.keyboard.up("w");
    await page.keyboard.press("e");
    try {
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Ambiente jogável"]')
            ?.getAttribute("data-hand-anchors")
            ?.includes("true"),
        undefined,
        { timeout: 30000 },
      );
    } catch (error) {
      process.stdout.write(`Grab failed: ${JSON.stringify(await read())}\n`);
      await page.screenshot({ path: "test-results/phase4-grab-failure.png" });
      throw error;
    }
    const grabbed = await read();
    await page.keyboard.down("w");
    try {
      await page.waitForFunction(
        () =>
          Number(
            document
              .querySelector('[aria-label="Ambiente jogável"]')
              ?.getAttribute("data-handoffs"),
          ) >= 3,
        undefined,
        { timeout: 45000 },
      );
    } catch (error) {
      process.stdout.write(`Handoff failed: ${JSON.stringify(await read())}\n`);
      throw error;
    } finally {
      await page.keyboard.up("w");
    }
    const swung = await read();
    await page.screenshot({ path: "test-results/phase4-vine.png" });
    const report = { spawn, walk, landed, reset, grabbed, swung, errors };
    await writeFile(
      "test-results/phase4-browser.json",
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (errors.length) throw new Error(errors.join("\n"));
  }
} finally {
  await browser.close();
}
