import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ["--use-angle=d3d11", "--disable-dev-shm-usage"],
});
const results = {};
const errors = [];
await mkdir("test-results", { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:3000/", { timeout: 120000 });
  await page.waitForFunction(
    () => window.__storyTest?.scene.getObjectByName("story-business"),
    null,
    { timeout: 120000 },
  );
  const scroll = async (progress) => {
    await page.evaluate(
      (p) =>
        window.scrollTo(
          0,
          (document.documentElement.scrollHeight - innerHeight) * p,
        ),
      progress,
    );
    await page.waitForTimeout(800);
  };
  const hinge = () =>
    page.evaluate(
      () =>
        2 *
        Math.acos(
          Math.abs(
            window.__storyTest.scene.getObjectByName("BusinessDoorHinge")
              .quaternion.w,
          ),
        ),
    );
  await scroll(0.375);
  assert.ok(Math.abs(await hinge()) < 0.01, "work door starts closed");
  await scroll(0.475);
  results.workDoorAngle = await hinge();
  await page.screenshot({ path: "test-results/story-work-entrance.png" });
  assert.ok(
    Math.abs(results.workDoorAngle) > 1.9,
    "work door opens before arrival",
  );
  await scroll(0.51);
  const portfolio = page.getByRole("region", { name: "Portfólio de projetos" });
  await portfolio.waitFor();
  results.links = await portfolio
    .locator("article > a")
    .evaluateAll((links) => links.map((a) => a.href));
  assert.equal(results.links.length, 6);
  assert.equal(new Set(results.links).size, 6);
  await page.screenshot({ path: "test-results/story-portfolio.png" });
  await page.getByRole("button", { name: "O relato no LinkedIn" }).click();
  assert.equal(
    await page.locator("dialog[open] iframe").getAttribute("src"),
    "https://www.linkedin.com/embed/feed/update/urn:li:share:7504048138572267520?collapsed=1",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog[open]").count(), 0);
  await scroll(1);
  assert.equal(
    await page.getByText("Role para descobrir", { exact: true }).count(),
    0,
  );
  await page.screenshot({ path: "test-results/story-end.png" });
  console.log("Story validated", JSON.stringify(results));

  await page.goto("http://localhost:3000/?map=phase3&skip", {
    timeout: 120000,
  });
  await page.waitForFunction(
    () => window.__canopyBodies?.[2] && window.__canopyTest,
    null,
    { timeout: 120000 },
  );
  await page.waitForFunction(
    () => {
      let found = false;
      window.__canopyTest.scene.traverse((object) => {
        if (object.name.endsWith("_pull-vine-start-anchor")) found = true;
      });
      return found;
    },
    null,
    { timeout: 30000 },
  );
  const photo = async (name, position, target) => {
    await page.evaluate(() =>
      window.__game.useGame.getState().configure({ paused: true }),
    );
    await page.waitForTimeout(150);
    const png = await page.evaluate(
      ({ position, target }) => {
        const { camera, scene, gl } = window.__canopyTest;
        gl.setSize(1440, 900, false);
        camera.aspect = 1440 / 900;
        camera.updateProjectionMatrix();
        camera.position.set(...position);
        camera.lookAt(...target);
        camera.updateMatrixWorld();
        gl.render(scene, camera);
        return gl.domElement.toDataURL("image/png");
      },
      { position, target },
    );
    await writeFile(
      `test-results/${name}.png`,
      Buffer.from(png.split(",")[1], "base64"),
    );
    await page.evaluate(() =>
      window.__game.useGame.getState().configure({ paused: false }),
    );
  };
  await photo("canopy-first-vine-anchor", [-9, 20, 22], [-17, 17.8, 14]);
  await page.evaluate(() => {
    const { runtime, useGame } = window.__game;
    useGame.getState().select(2);
    const p = { x: -13, y: 8.6, z: 14 };
    const body = window.__canopyBodies[2];
    body.setBodyType(0, true);
    body.setTranslation(p, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    runtime.positions[2] = { ...p };
  });
  await page.waitForTimeout(100);
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => window.__game.runtime.motions[2] === "vine-walk",
    null,
    { timeout: 5000 },
  );
  await page.evaluate(() => {
    window.__game.runtime.yaw = 0;
  });
  await page.keyboard.down("w");
  await page.waitForFunction(
    () =>
      window.__game.runtime.positions[2].y > 22 &&
      window.__game.runtime.motions[2] !== "vine-walk",
    null,
    { timeout: 30000 },
  );
  await page.keyboard.up("w");
  results.firstVineLanding = await page.evaluate(() => ({
    ...window.__game.runtime.positions[2],
  }));
  console.log("First vine validated", results.firstVineLanding);

  await page.evaluate(() =>
    window.__game.useGame
      .getState()
      .configure({ map: "islands", paused: false }),
  );
  await page.waitForFunction(
    () =>
      document.querySelector('[data-map="islands"]') &&
      Number(document.querySelector('[data-map="islands"]').getAttribute('data-position')?.split(',')[2]) > 0 &&
      window.__game.runtime.positions[2].y < 3,
    null,
    { timeout: 120000 },
  );
  // The map attribute updates before Suspense finishes loading its assets.
  // Wait for physics to settle before arranging the construction regression.
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const { useGame: s } = window.__game;
    s.setState((state) => ({
      puzzle: {
        ...state.puzzle,
        bridge: false,
        selected: 2,
        logs: [true, true, true],
        powers: [false, true, false],
      },
    }));
  });
  await page.waitForTimeout(100);
  results.construction = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const { useGame: s, runtime: r } = window.__game;
        for (const [id, p] of [
          [0, { x: -3, y: 1.85, z: 3 }],
          [1, { x: 3, y: 1.85, z: 3 }],
          [2, { x: 3.4, y: 1.85, z: -1.7 }],
        ]) {
          const b = window.__canopyBodies[id];
          b.setBodyType(0, true);
          b.setTranslation(p, true);
          b.setLinvel({ x: 0, y: 0, z: 0 }, true);
          r.positions[id] = { ...p };
        }
        const before = r.positions.map((p) => ({ ...p })),
          previous = before.map((p) => ({ ...p })),
          steps = [0, 0, 0];
        s.getState().build({ x: 3.4, y: 1.2, z: -1.7 });
        const start = performance.now();
        const tick = () => {
          for (const id of [0, 1, 2]) {
            const p = r.positions[id];
            steps[id] = Math.max(
              steps[id],
              Math.hypot(p.x - previous[id].x, p.z - previous[id].z),
            );
            previous[id] = { ...p };
          }
          if (performance.now() - start < 2000) requestAnimationFrame(tick);
          else
            resolve({
              bridge: s.getState().puzzle.bridge,
              before,
              after: r.positions.map((p) => ({ ...p })),
              steps,
            });
        };
        requestAnimationFrame(tick);
      }),
  );
  assert.equal(results.construction.bridge, true);
  assert.ok(
    results.construction.steps.every((s) => s < 0.75),
    "building must not reposition any monkey, including powered gold",
  );
  assert.ok(results.construction.steps.slice(0, 2).every(step => step > 0), 'both followers must be actively simulated during construction');
  assert.ok(
    results.construction.after.every((p) => p.z > -5),
    "followers must remain on island one after construction",
  );
  console.log(
    "Construction regression validated",
    JSON.stringify(results.construction),
  );
  await page.evaluate(() => {
    const p = { x: 0, y: 1.85, z: -23 };
    const b = window.__canopyBodies[2];
    b.setTranslation(p, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    window.__game.runtime.positions[2] = { ...p };
  });
  results.followers = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const r = window.__game.runtime;
        const previous = r.positions.map((p) => ({ ...p }));
        const steps = [0, 0],
          sawBridge = [false, false];
        const start = performance.now();
        function tick() {
          for (const id of [0, 1]) {
            const p = r.positions[id];
            steps[id] = Math.max(
              steps[id],
              Math.hypot(p.x - previous[id].x, p.z - previous[id].z),
            );
            if (p.z < -5 && p.z > -14) sawBridge[id] = true;
            previous[id] = { ...p };
          }
          if (
            (r.positions[0].z < -17 && r.positions[1].z < -17) ||
            performance.now() - start > 25000
          )
            resolve({
              steps,
              sawBridge,
              positions: r.positions.map((p) => ({ ...p })),
            });
          else requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }),
  );
  assert.deepEqual(results.followers.sawBridge, [true, true]);
  assert.ok(results.followers.steps.every((step) => step < 0.75));
  assert.ok(results.followers.positions.slice(0, 2).every((p) => p.z < -17));
  await page.evaluate(() =>
    window.__game.useGame.getState().configure({ map: "phase2" }),
  );
  await page.waitForFunction(
    () => document.querySelector('[data-map="phase2"]'),
    null,
    { timeout: 120000 },
  );
  await page.waitForTimeout(1000);
  await page.evaluate(() =>
    window.__game.useGame.getState().configure({ map: "islands" }),
  );
  await page.waitForFunction(
    () =>
      document.querySelector('[data-map="islands"]') &&
      window.__game.runtime.positions.every((p) => p.z < -17 && p.y < 3),
    null,
    { timeout: 120000 },
  );
  results.returnCheckpoint = await page.evaluate(() =>
    window.__game.runtime.positions.map((p) => ({ ...p })),
  );
  assert.deepEqual(errors, []);
  results.passed = true;
  console.log("All browser checks passed");
} finally {
  results.errors = errors;
  await writeFile(
    "test-results/story-followers-validation.json",
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
