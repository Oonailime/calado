import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  args: ["--use-angle=d3d11", "--disable-dev-shm-usage"],
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:3000/?map=phase2&skip", {
    timeout: 120000,
  });
  await page.waitForFunction(
    () => window.__canopyTest && window.__canopyBodies?.[2],
    null,
    { timeout: 120000 },
  );
  await page.evaluate(() => {
    const s = window.__game.useGame;
    s.setState((state) => ({
      map: "islands",
      puzzle: {
        ...state.puzzle,
        bridge: true,
        built: false,
        unlocked: false,
        codeProgress: 0,
        selected: 2,
      },
    }));
  });
  await page.waitForFunction(
    () => window.__canopyTest.scene.getObjectByName("OrnatePadlockBody"),
    null,
    { timeout: 120000 },
  );
  await page.waitForTimeout(3000);
  await mkdir("test-results", { recursive: true });
  const photo = async (name, position, target) => {
    await page.evaluate(() =>
      window.__game.useGame.getState().configure({ paused: true }),
    );
    await page.waitForTimeout(100);
    const data = await page.evaluate(
      ({ position, target }) => {
        const { gl, scene, camera } = window.__canopyTest;
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
      Buffer.from(data.split(",")[1], "base64"),
    );
    await page.evaluate(() =>
      window.__game.useGame.getState().configure({ paused: false }),
    );
  };
  await photo("padlock-closed", [0.75, 1.97, -21.4], [0, 1.76, -23.8]);
  await photo("padlock-back", [-0.75, 1.97, -26.2], [0, 1.76, -23.8]);
  await page.evaluate(() => {
    const s = window.__game.useGame;
    for (const digit of [1, 9, 9, 8])
      s.getState().submitLockDigit({ x: 0, y: 1.2, z: -23.8 }, digit);
  });
  await page.waitForFunction(
    () => {
      const shackle = window.__canopyTest.scene.getObjectByName(
        "OrnatePadlockShackle",
      );
      return shackle?.rotation.y < -1.25 && shackle.position.y > 0.82;
    },
    null,
    { timeout: 10000 },
  );
  assert.equal(
    await page.evaluate(() => window.__game.useGame.getState().puzzle.unlocked),
    true,
  );
  await photo("padlock-open", [0.75, 1.97, -21.4], [0, 1.76, -23.8]);
  await page.evaluate(() =>
    window.__game.useGame.setState((state) => ({
      puzzle: { ...state.puzzle, unlocked: false, codeProgress: 0 },
    })),
  );
  await page.waitForFunction(
    () =>
      Math.abs(
        window.__canopyTest.scene.getObjectByName("OrnatePadlockShackle")
          .rotation.y,
      ) < 0.02,
    null,
    { timeout: 10000 },
  );
  const stats = await page.evaluate(() => {
    const model = window.__canopyTest.scene.getObjectByName("OrnatePadlock");
    let triangles = 0,
      meshes = 0;
    model.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        triangles +=
          (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      }
    });
    return { triangles, meshes };
  });
  assert.ok(stats.triangles < 30000);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, ...stats, errors }));
} finally {
  await browser.close();
}
