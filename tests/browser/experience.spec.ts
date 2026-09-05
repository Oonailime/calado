import { test, expect, type Page, type Locator } from "@playwright/test";

async function scrollTo(page: Page, progress: number) {
  await page.evaluate(
    (p) =>
      window.scrollTo(
        0,
        (document.documentElement.scrollHeight - innerHeight) * p,
      ),
    progress,
  );
}
async function position(game: Locator) {
  return ((await game.getAttribute("data-position")) || "0,0,0")
    .split(",")
    .map(Number);
}
async function walk(
  page: Page,
  game: Locator,
  key: string,
  axis: 0 | 2,
  target: number,
  less = true,
) {
  await page.keyboard.down(key);
  try {
    await expect
      .poll(
        async () => {
          const p = await position(game);
          return less ? p[axis] <= target : p[axis] >= target;
        },
        { timeout: 25_000, intervals: [50, 100] },
      )
      .toBe(true);
  } finally {
    await page.keyboard.up(key);
  }
}
async function enter(page: Page) {
  await page.goto("/");
  await scrollTo(page, 1);
  const play = page.getByRole("button", { name: "Jogar ↗" });
  await expect(play).toBeEnabled({ timeout: 90_000 });
  await play.click();
  const game = page.getByRole("region", { name: "Ambiente jogável" });
  await expect(game).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  return game;
}

test("animatic avança, retorna e traduz sem carregar o mundo no início", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Meu nome é Emiliano Calado." }),
  ).toBeVisible();
  expect(
    requests.some((url) => /rapier|three_fiber|features_game_Game/.test(url)),
  ).toBe(false);
  await page.screenshot({ path: "test-results/animatic-inicio.png" });
  await scrollTo(page, 0.45);
  await expect(
    page.getByRole("heading", {
      name: "E comecei a construir minhas próprias respostas.",
    }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/animatic-ufba.png" });
  await scrollTo(page, 0);
  await expect(
    page.getByRole("heading", { name: "Meu nome é Emiliano Calado." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My name is Emiliano Calado." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("caderno apresenta os 14 quadros e animatic editável", async ({
  page,
}) => {
  test.skip(
    process.env.TEST_PRODUCTION === "1",
    "Caderno interno é desativado na produção.",
  );
  await page.goto("/estudo");
  await expect(page.locator("figure")).toHaveCount(14);
  await expect(
    page.getByRole("img", { name: /Estudo dos macacos/ }),
  ).toBeVisible();
  const slider = page.getByRole("slider", { name: "Progresso do animatic" });
  await slider.fill("0.55");
  await expect(page.locator("output")).toHaveText("55%");
  await slider.fill("0.2");
  await expect(page.locator("output")).toHaveText("20%");
  await page.screenshot({ path: "test-results/caderno.png", fullPage: true });
});

test("celular recebe orientação para PC e não baixa o jogo", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(process.env.TEST_BASE_URL || "http://localhost:3000/");
  await expect(page.getByText(/Use um PC com teclado/)).toBeVisible();
  expect(requests.some((url) => /rapier|features_game_Game/.test(url))).toBe(
    false,
  );
  await context.close();
});

test("jogo coopera na ponte, recupera checkpoint e libera scroll com Esc", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Software-rendered Chromium needs a smaller canvas for precise key movement.
  await page.setViewportSize({ width: 1024, height: 640 });
  const game = await enter(page);
  await page.getByRole("button", { name: "Pausa e configurações" }).click();
  await page.getByLabel("Qualidade gráfica").selectOption("low");
  await page.getByRole("button", { name: "Retomar", exact: true }).click();
  await game.focus();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.screenshot({ path: "test-results/prototipo-inicio.png" });
  // Mizaru alcança o símbolo da primeira ponte por movimento real.
  await page.keyboard.press("Digit1");
  await expect(game).toHaveAttribute("data-selected", "0");
  await page.keyboard.press("Space");
  await expect(game).toHaveAttribute("data-grounded", "false");
  await page.screenshot({ path: "test-results/macaco-pulo.png" });
  await expect(game).toHaveAttribute("data-grounded", "true", {
    timeout: 10_000,
  });
  await walk(page, game, "KeyD", 0, -0.1, false);
  await walk(page, game, "KeyW", 2, 1.2);
  await page.keyboard.down("KeyW");
  await page.keyboard.press("Space");
  await expect
    .poll(async () => (await position(game))[2], { timeout: 20_000 })
    .toBeLessThan(-1.3);
  await page.keyboard.up("KeyW");
  await walk(page, game, "KeyW", 2, -3.7);
  await page.keyboard.down("KeyF");
  await page.keyboard.press("Digit3");
  await page.keyboard.up("KeyF");
  await expect(game).toHaveAttribute("data-sustained", "true,false,false");
  // Centralizar Calado antes de cruzar o vão.
  const p = await position(game);
  if (p[0] > 0.3) await walk(page, game, "KeyA", 0, 0.1);
  else if (p[0] < -0.3) await walk(page, game, "KeyD", 0, -0.1, false);
  await walk(page, game, "KeyW", 2, -9.5);
  // Capsule center = soil/bridge surface (1.2) + capsule half-height (0.55).
  await expect.poll(async () => (await position(game))[1]).toBeCloseTo(1.75, 1);
  await walk(page, game, "KeyW", 2, -14);
  await expect.poll(async () => (await position(game))[1]).toBeCloseTo(1.75, 1);
  await page.keyboard.press("KeyE");
  await expect(game).toHaveAttribute("data-bridge", "true");
  await page.screenshot({ path: "test-results/prototipo-ponte.png" });
  await page.keyboard.press("KeyR");
  await expect(game).toHaveAttribute("data-bridge", "true");
  await expect(game).toHaveAttribute("data-revision", "1");
  await expect.poll(async () => (await position(game))[1]).toBeCloseTo(1.75, 1);
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.getByRole("button", { name: "Retomar ↗" })).toBeVisible();
  await page.getByRole("button", { name: "Retomar ↗" }).click();
  await expect(game).toHaveAttribute("data-bridge", "true");
  expect(errors).toEqual([]);
});
