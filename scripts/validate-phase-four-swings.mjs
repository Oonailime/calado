import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  headless: true,
  args: ["--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("test-results", { recursive: true });
try {
  await page.goto("http://localhost:3000/?map=phase4", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__game?.runtime.swingingVines.size === 7 && document.querySelector('[data-grounded="true"]'), null, { timeout: 120000 });
  process.stdout.write("Map ready: seven two-ended vines.\n");
  await page.keyboard.press("1");
  await page.screenshot({ path: "test-results/phase4-new-vines.png" });
  const walkTo = async (x, z) => page.evaluate(async ([x, z]) => {
    const { runtime, useGame } = window.__game;
    const down = new Set();
    const sync = (keys) => {
      for (const key of down) if (!keys.has(key)) { window.dispatchEvent(new KeyboardEvent("keyup", { code: key })); down.delete(key); }
      for (const key of keys) if (!down.has(key)) { window.dispatchEvent(new KeyboardEvent("keydown", { code: key })); down.add(key); }
    };
    const deadline = performance.now() + 30000;
    try {
      while (performance.now() < deadline) {
        const p = runtime.positions[useGame.getState().puzzle.selected];
        const dx = x - p.x, dz = z - p.z;
        if (Math.hypot(dx, dz) < 0.15) return;
        const f = -dx * Math.sin(runtime.yaw) - dz * Math.cos(runtime.yaw);
        const r = dx * Math.cos(runtime.yaw) - dz * Math.sin(runtime.yaw);
        const keys = new Set();
        if (Math.abs(f) > 0.07) keys.add(f > 0 ? "KeyW" : "KeyS");
        if (Math.abs(r) > 0.07) keys.add(r > 0 ? "KeyD" : "KeyA");
        sync(keys);
        await new Promise(requestAnimationFrame);
      }
      throw new Error("walk timed out");
    } finally { sync(new Set()); }
  }, [x, z]);

  await walkTo(-11.2, 12.4);
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__game.runtime.activeVine?.siteId.startsWith("phase4-hold-"), null, { timeout: 15000 });
  process.stdout.write("Climbing the original vine to the plateau.\n");
  await page.keyboard.down("w");
  await page.waitForFunction(() => {
    const { runtime, useGame } = window.__game;
    const p = runtime.positions[useGame.getState().puzzle.selected];
    return p.y > 22.9 && p.z < -4;
  }, null, { timeout: 180000 });
  await page.keyboard.up("w");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => {
    const { runtime, useGame } = window.__game;
    const id = useGame.getState().puzzle.selected;
    return runtime.grounded[id] && runtime.positions[id].y > 22;
  }, null, { timeout: 15000 });
  await page.screenshot({ path: "test-results/phase4-high-plateau.png" });
  process.stdout.write("Plateau reached through the climbing vine.\n");
  await walkTo(-2, -8.5);
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__game.runtime.activeVine?.siteId === "phase4-swing-plateau", null, { timeout: 15000 });
  const releasedTie = await page.evaluate(() => window.__game.runtime.swingingVines.get("phase4-swing-plateau").releasedAttachment);
  assert.equal(releasedTie, "rear");
  await page.waitForTimeout(800);
  const hang = await page.evaluate(async () => {
    const { runtime, useGame } = window.__game;
    const samples = [];
    const deadline = performance.now() + 12000;
    while (performance.now() < deadline) {
      const d = runtime.movementDebug[useGame.getState().puzzle.selected];
      samples.push(JSON.parse(JSON.stringify({
        position: d.position, velocity: d.velocity,
        leftShoulder: d.rigLeftShoulder, rightShoulder: d.rigRightShoulder,
        leftError: d.leftConstraintError, rightError: d.rightConstraintError,
        left: d.hasLeftAnchor, right: d.hasRightAnchor,
        surface: d.hasSwingSurface, leftFoot: d.leftFoot, rightFoot: d.rightFoot,
      })));
      await new Promise(requestAnimationFrame);
    }
    return samples;
  });
  assert.ok(hang.length > 60);
  const bar = (s) => [s.leftShoulder.x - s.rightShoulder.x, s.leftShoulder.z - s.rightShoulder.z];
  const initial = bar(hang[0]);
  for (const sample of hang) {
    assert.ok(sample.left || sample.right, "hand must stay attached");
    const current = bar(sample);
    assert.ok((current[0] * initial[0] + current[1] * initial[1]) / (Math.hypot(...current) * Math.hypot(...initial)) > 0.99, "shoulders must not reverse with the pendulum");
    assert.ok(Math.max(sample.leftError, sample.rightError) < 0.1, "rope must not stretch; slack is allowed");
  }
  await page.screenshot({ path: "test-results/phase4-pendulum-hang.png" });
  // Release near the bottom while moving away from the tree.
  await page.keyboard.down("w");
  await page.waitForFunction(() => {
    const { runtime, useGame } = window.__game;
    const d = runtime.movementDebug[useGame.getState().puzzle.selected];
    return Math.hypot(d.velocity.x, d.velocity.z) > 1 && d.velocity.y > 0.2;
  }, null, { timeout: 20000 });
  const flight = await page.evaluate(async () => {
    const { runtime, useGame } = window.__game;
    const d = () => runtime.movementDebug[useGame.getState().puzzle.selected];
    const before = JSON.parse(JSON.stringify(d()));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
    const samples = [];
    for (let i = 0; i < 8; i++) {
      await new Promise(requestAnimationFrame);
      samples.push(JSON.parse(JSON.stringify(d())));
    }
    return { before, samples };
  });
  await page.keyboard.up("w");
  const airborne = flight.samples.filter((s) => s.state === "RELEASE" || s.state === "FLIGHT");
  assert.ok(airborne.length > 0);
  for (const sample of airborne) {
    assert.ok(!sample.hasLeftAnchor && !sample.hasRightAnchor);
    assert.ok(Math.abs(sample.velocity.x - flight.before.velocity.x) < 0.12);
    assert.ok(Math.abs(sample.velocity.z - flight.before.velocity.z) < 0.12);
  }
  await page.screenshot({ path: "test-results/phase4-pendulum-release.png" });
  assert.deepEqual(errors, []);
  await writeFile("test-results/phase4-swing-validation.json", JSON.stringify({ hang, flight, errors }, null, 2));
  process.stdout.write(JSON.stringify({ hangingSamples: hang.length, flightSamples: airborne.length, errors }) + "\n");
} catch (error) {
  await page.screenshot({ path: "test-results/phase4-swing-failure.png" });
  process.stdout.write(await page.locator('[aria-label="Ambiente jogável"]').evaluate((el) => el.outerHTML.slice(0, 2500)) + "\n");
  throw error;
} finally { await browser.close(); }
