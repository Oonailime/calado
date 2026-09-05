import { test, expect } from "@playwright/test";

test("macacos ficam acima da superfície das ilhas ao nascer e reposicionar", async ({
  page,
}) => {
  await page.goto("/");
  // Confirm hydration before scrolling: ScrollTrigger is registered in an effect.
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My name is Emiliano Calado." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Português", exact: true }).click();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const play = page.getByRole("button", { name: "Jogar ↗" });
  await expect(play).toBeEnabled({ timeout: 90_000 });
  await play.click();
  const game = page.getByRole("region", { name: "Ambiente jogável" });
  await expect(game).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await expect
    .poll(async () => {
      const calls = await game.getAttribute("data-draw-calls");
      return calls ? Number(calls) : Infinity;
    })
    .toBeLessThan(100);
  // A malha extrudada tem sua superfície em y=1.2; a cápsula tem meia altura .55.
  // Medir o repouso evita aceitar somente um spawn alto que depois afunda.
  const stableAboveGround = async () => {
    await expect
      .poll(async () =>
        Number((await game.getAttribute("data-position"))?.split(",")[1]),
      )
      .toBeCloseTo(1.75, 1);
    await expect
      .poll(async () => {
        const first = Number(
          (await game.getAttribute("data-position"))?.split(",")[1],
        );
        await page.waitForTimeout(400);
        const second = Number(
          (await game.getAttribute("data-position"))?.split(",")[1],
        );
        return first > 1.7 && second > 1.7 && Math.abs(second - first) < 0.03;
      })
      .toBe(true);
  };
  await page.screenshot({ path: "test-results/ilha-nascimento.png" });
  for (const key of ["Digit1", "Digit2", "Digit3"]) {
    await page.keyboard.press(key);
    await stableAboveGround();
  }
  await page.keyboard.press("KeyR");
  await expect(game).toHaveAttribute("data-revision", "1");
  await stableAboveGround();
  await page.screenshot({ path: "test-results/ilha-reposicionamento.png" });
});
