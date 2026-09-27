import { test, expect } from "@playwright/test";
import type { RapierRigidBody } from "@react-three/rapier";

type GameWindow = Window & {
  __game: typeof import("../../src/features/game/state/store");
  __canopyBodies: RapierRigidBody[];
};

test("cadeado só acusa erro após confirmar e aceita números do teclado físico", async ({ page }) => {
  await page.goto("/?map=islands&skip");
  await expect(page.locator('[data-ready="true"]')).toBeVisible({ timeout: 90_000 });
  await page.waitForFunction(() => (window as unknown as GameWindow).__canopyBodies?.[2]);
  await page.evaluate(() => {
    const { __game: { useGame, runtime }, __canopyBodies } = window as unknown as GameWindow;
    useGame.getState().select(2);
    const position = { x: 0, y: 1.75, z: -22 };
    __canopyBodies[2].setTranslation(position, true);
    __canopyBodies[2].setLinvel({ x: 0, y: 0, z: 0 }, true);
    runtime.positions[2] = position;
  });
  const dialog = page.getByRole("dialog", { name: "Cadeado do totem" });
  const current = dialog.locator('[data-state="current"]');
  const error = dialog.getByRole("alert");
  const attempts = () => page.evaluate(() => (window as unknown as GameWindow).__game.useGame.getState().puzzle.wrongAttempts);

  await page.keyboard.down("Enter");
  await expect(dialog).toBeVisible();
  await expect(current).toHaveText("0");
  await expect(error).toHaveText("");
  await page.keyboard.down("Enter"); // auto-repeat while the opening key is held
  expect(await attempts()).toBe(0);
  await page.keyboard.up("Enter");

  await page.keyboard.press("Enter");
  await expect(error).toHaveText("Algarismo incorreto. Tente novamente.");
  expect(await attempts()).toBe(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.keyboard.press("KeyE");
  await expect(dialog).toBeVisible();
  await expect(error).toHaveText(""); // reopening must not replay a previous miss

  await dialog.getByRole("button", { name: "Pedir uma dica", exact: true }).click();
  await page.keyboard.press("Digit1"); // typing also works after focusing a hint button
  await expect(current).toHaveText("1");
  expect(await attempts()).toBe(1);
  expect(await page.evaluate(() => (window as unknown as GameWindow).__game.useGame.getState().puzzle.selected)).toBe(2);
  await expect(dialog.locator('[data-state="correct"]')).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(dialog.locator('[data-state="correct"]')).toHaveCount(1);

  await page.keyboard.press("ArrowUp");
  await expect(current).toHaveText("1");
  await page.keyboard.press("ArrowDown");
  await expect(current).toHaveText("0");
  await page.keyboard.press("Numpad9");
  await expect(current).toHaveText("9");
  await page.keyboard.press("NumpadEnter");
  await expect(dialog.locator('[data-state="correct"]')).toHaveCount(2);

  // Consecutive events before a React render must confirm the newly typed digit.
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "9", code: "Digit9" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter" }));
  });
  await expect(dialog.locator('[data-state="correct"]')).toHaveCount(3);
  await page.keyboard.press("Digit8");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as GameWindow).__game.useGame.getState().puzzle.unlocked)).toBe(true);
  expect(await attempts()).toBe(1);
});
