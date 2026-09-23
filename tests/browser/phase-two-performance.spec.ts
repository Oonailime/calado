import { test, expect, type Page } from "@playwright/test";

type FpsSample = {
  fps: number;
  frames: number;
  elapsedMs: number;
  longestFrameMs: number;
};

async function measureFps(page: Page, durationMs: number): Promise<FpsSample> {
  return page.evaluate(
    (duration) =>
      new Promise<FpsSample>((resolve) => {
        const startedAt = performance.now();
        let frames = 0;
        let previousAt = startedAt;
        let longestFrameMs = 0;

        const sample = (now: number) => {
          frames += 1;
          longestFrameMs = Math.max(longestFrameMs, now - previousAt);
          previousAt = now;
          const elapsedMs = now - startedAt;
          if (elapsedMs >= duration) {
            resolve({
              fps: (frames * 1_000) / elapsedMs,
              frames,
              elapsedMs,
              longestFrameMs,
            });
            return;
          }
          requestAnimationFrame(sample);
        };

        requestAnimationFrame(sample);
      }),
    durationMs,
  );
}

async function measureImmediateSwitchFps(
  page: Page,
  previousSelected: string,
  durationMs: number,
): Promise<FpsSample> {
  return page.evaluate(
    ({ previous, duration }) =>
      new Promise<FpsSample>((resolve) => {
        // The promise is armed before Playwright sends the key. Starting the
        // clock here includes the event, React commit and first render frame
        // that belong to the switch itself.
        const armedAt = performance.now();
        let switched = false;
        let frames = 0;
        let previousAt = armedAt;
        let longestFrameMs = 0;

        const sample = (now: number) => {
          const selected = document
            .querySelector('[data-map="phase2"]')
            ?.getAttribute("data-selected");
          if (!switched) {
            if (selected !== previous) switched = true;
          }
          if (switched) {
            frames += 1;
            longestFrameMs = Math.max(longestFrameMs, now - previousAt);
            previousAt = now;
            const elapsedMs = now - armedAt;
            if (elapsedMs >= duration) {
              resolve({
                fps: (frames * 1_000) / elapsedMs,
                frames,
                elapsedMs,
                longestFrameMs,
              });
              return;
            }
          }
          requestAnimationFrame(sample);
        };

        requestAnimationFrame(sample);
      }),
    { previous: previousSelected, duration: durationMs },
  );
}

test("trocar personagens no mapa 2 não reduz o FPS em mais de 30%", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.goto("/?map=phase2");
  const game = page.getByRole("region", { name: "Ambiente jogável" });
  await expect(game).toHaveAttribute("data-ready", "true", {
    timeout: 90_000,
  });
  await expect(game).toHaveAttribute("data-grounded", "true", {
    timeout: 90_000,
  });

  // Let model uploads, shaders and the first camera frames settle before
  // taking the reference. The same render loop is used for every sample.
  await page.waitForTimeout(2_000);
  const baseline = await measureFps(page, 1_200);
  const samples: Array<{
    key: string;
    selected: string;
    fps: FpsSample;
    change: number;
  }> = [];

  // Two switches inside one render window reproduce the accumulation seen
  // during fast manual input. The probe is armed before either key is sent.
  const rapidFpsPromise = measureFps(page, 450);
  await page.keyboard.press("Digit1");
  await page.waitForTimeout(40);
  await page.keyboard.press("Digit2");
  await expect(game).toHaveAttribute("data-selected", "0");
  const rapidFps = await rapidFpsPromise;
  const rapidChange = rapidFps.fps / baseline.fps - 1;
  samples.push({
    key: "Digit1+Digit2 rapid",
    selected: "0",
    fps: rapidFps,
    change: rapidChange,
  });
  expect(
    rapidFps.fps,
    `FPS caiu ${(rapidChange * 100).toFixed(1)}% após duas trocas rápidas; baseline=${baseline.fps.toFixed(1)}, sample=${rapidFps.fps.toFixed(1)}, longestFrame=${rapidFps.longestFrameMs.toFixed(1)}ms`,
  ).toBeGreaterThanOrEqual(baseline.fps * 0.7);

  for (const [key, selected] of [
    ["Digit3", "2"],
    ["Digit1", "1"],
    ["Digit2", "0"],
    ["Digit3", "2"],
  ] as const) {
    const previousSelected = await game.getAttribute("data-selected");
    const immediateFps = measureImmediateSwitchFps(
      page,
      previousSelected ?? "",
      450,
    );
    await page.keyboard.press(key);
    await expect(game).toHaveAttribute("data-selected", selected);
    const fps = await immediateFps;
    const change = fps.fps / baseline.fps - 1;
    samples.push({ key, selected, fps, change });

    expect(
      fps.fps,
      `FPS caiu ${(change * 100).toFixed(1)}% após ${key}; baseline=${baseline.fps.toFixed(1)}, sample=${fps.fps.toFixed(1)}, longestFrame=${fps.longestFrameMs.toFixed(1)}ms`,
    ).toBeGreaterThanOrEqual(baseline.fps * 0.7);
  }

  await test.info().attach("phase2-fps-switches.json", {
    body: JSON.stringify({ baseline, samples }, null, 2),
    contentType: "application/json",
  });
});
