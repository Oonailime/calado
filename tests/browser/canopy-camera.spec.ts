import { expect, test } from "@playwright/test";
import { PHASE_FOUR_CUBE_PIECE_SPAWNS } from "../../src/features/game/world/phaseFourLayout";

test("a copa do platô alto libera a câmera e mostra o comando do cipó", async ({ page }) => {
  await page.goto("/?map=phase3");
  const game = page.getByRole("region", { name: "Ambiente jogável" });
  await expect(game).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await page.waitForFunction(() => !!(window as unknown as { __canopyBodies?: unknown[] }).__canopyBodies?.[2]);
  await page.evaluate(() => {
    const testing = window as unknown as {
      __game: { runtime: { positions: { x: number; y: number; z: number }[] }; useGame: { getState: () => { configure: (patch: object) => void; select: (id: number) => void } } };
      __canopyBodies: { setBodyType: (kind: number, wake: boolean) => void; setTranslation: (point: object, wake: boolean) => void; setLinvel: (velocity: object, wake: boolean) => void }[];
    };
    const position = { x: -3, y: 23.2, z: -7 };
    testing.__game.useGame.getState().configure({ paused: false });
    testing.__game.useGame.getState().select(2);
    testing.__canopyBodies[2].setBodyType(0, true);
    testing.__canopyBodies[2].setTranslation(position, true);
    testing.__canopyBodies[2].setLinvel({ x: 0, y: 0, z: 0 }, true);
    testing.__game.runtime.positions[2] = position;
  });
  await expect(page.getByRole("status").filter({ hasText: "Platô alto · cipós pendulares" })).toBeVisible();
  await page.waitForTimeout(2500);
  await expect.poll(() => page.evaluate(() => {
    const scene = (window as unknown as { __canopyTest: { scene: { getObjectByName: (name: string) => { children: { material?: { opacity: number } }[] } } } }).__canopyTest.scene;
    const tree = scene.getObjectByName("Phase4_CanopyVillage_tree-91");
    return tree.children.find(child => child.material)?.material?.opacity ?? 1;
  })).toBeLessThan(0.1);
  await page.screenshot({ path: "test-results/high-plateau-camera.png" });

  await page.evaluate(() => {
    const testing = window as unknown as {
      __game: { runtime: { positions: { x: number; y: number; z: number }[] } };
      __canopyBodies: { setTranslation: (point: object, wake: boolean) => void; setLinvel: (velocity: object, wake: boolean) => void }[];
    };
    const position = { x: 12.53, y: 31.55, z: -48.22 };
    testing.__canopyBodies[2].setTranslation(position, true);
    testing.__canopyBodies[2].setLinvel({ x: 0, y: 0, z: 0 }, true);
    testing.__game.runtime.positions[2] = position;
  });
  await expect(page.getByRole("status").filter({ hasText: "Aproxime-se do prisma marrom" })).toBeVisible();
  const [x, y, z] = PHASE_FOUR_CUBE_PIECE_SPAWNS[2];
  await page.evaluate(position => {
    const game = (window as unknown as { __game: { useGame: { getState: () => { collectCube: (id: number, position: object) => boolean } } } }).__game;
    if (!game.useGame.getState().collectCube(2, position)) throw new Error("Brown prism was not collected");
  }, { x, y, z });
  await expect(page.getByRole("status").filter({ hasText: "Leve o prisma marrom ao totem" })).toBeVisible();

  await page.evaluate(() => {
    const testing = window as unknown as {
      __game: { runtime: { positions: { x: number; y: number; z: number }[] } };
      __canopyBodies: { setTranslation: (point: object, wake: boolean) => void; setLinvel: (velocity: object, wake: boolean) => void }[];
    };
    const position = { x: 0, y: 41.7, z: -68 };
    testing.__canopyBodies[2].setTranslation(position, true);
    testing.__canopyBodies[2].setLinvel({ x: 0, y: 0, z: 0 }, true);
    testing.__game.runtime.positions[2] = position;
  });
  await expect(page.getByRole("status").filter({ hasText: "Faltam 3 prismas" })).toContainText("Pressione E no totem para entregar o seu");
});
