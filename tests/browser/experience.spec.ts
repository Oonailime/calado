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
async function approach(
  page: Page,
  game: Locator,
  axis: 0 | 2,
  target: number,
) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const current = (await position(game))[axis];
    const difference = target - current;
    if (Math.abs(difference) < 0.45) return;
    const key =
      axis === 0
        ? difference > 0
          ? "KeyD"
          : "KeyA"
        : difference > 0
          ? "KeyS"
          : "KeyW";
    await page.keyboard.down(key);
    await page.waitForTimeout(
      Math.min(180, Math.max(55, Math.abs(difference) * 35)),
    );
    await page.keyboard.up(key);
    await page.waitForTimeout(90);
  }
  await expect
    .poll(async () => Math.abs((await position(game))[axis] - target))
    .toBeLessThan(0.55);
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
  // The homepage now opens on a lightweight 3D intro scene, so @react-three/fiber
  // itself is expected on first paint — only the physics engine and the full
  // game bundle stay deferred until the visitor is near the end of the scroll.
  expect(requests.some((url) => /rapier|features_game_Game/.test(url))).toBe(
    false,
  );
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
  // Kikazaru alcança o símbolo dourado da primeira ponte por movimento real.
  await page.keyboard.press("Digit1");
  await expect(game).toHaveAttribute("data-selected", "1");
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
  await approach(page, game, 0, 0);
  await approach(page, game, 2, -2);
  await page.keyboard.down("KeyF");
  await page.keyboard.press("Digit3");
  await page.keyboard.up("KeyF");
  await expect(game).toHaveAttribute("data-sustained", "false,true,false");
  // Iwazaru recolhe as três madeiras reveladas ainda na primeira ilha.
  await approach(page, game, 0, -2.4);
  await approach(page, game, 2, -0.2);
  await page.keyboard.press("KeyE");
  await expect(game).toHaveAttribute("data-logs", "true,false,false");
  await expect(game.locator('[data-item="wood"]')).toContainText("1/3");
  await expect(game.locator('[data-pickup="wood"]')).toBeVisible();
  await expect(game.locator('[data-pickup="wood"]')).toHaveCount(0, {
    timeout: 6_500,
  });
  await approach(page, game, 0, 2.4);
  await approach(page, game, 2, -0.2);
  await page.keyboard.press("KeyE");
  await expect(game).toHaveAttribute("data-logs", "true,true,false");
  await approach(page, game, 0, 0);
  await approach(page, game, 2, -3.6);
  await page.keyboard.press("KeyE");
  await expect(game).toHaveAttribute("data-logs", "true,true,true");
  await expect(game.locator('[data-item="wood"]')).toContainText("3/3");
  // O primeiro totem fica à direita da entrada da ponte. Contorna sua base
  // pela lateral sul antes de alinhar no eixo X.
  await approach(page, game, 2, -3.35);
  await approach(page, game, 0, 3.4);
  await page.keyboard.press("KeyE");
  await expect(game).toHaveAttribute("data-bridge", "true");
  await expect(game.locator('[data-item="wood"]')).toHaveCount(0);
  await expect(game.locator('[data-pickup="wood"]')).toHaveCount(0);
  await page.waitForTimeout(1_000);
  await page.screenshot({
    path: "test-results/prototipo-ponte-construcao.png",
  });
  // Espera as doze seções de madeira pousarem antes de atravessar.
  await page.waitForTimeout(2_500);
  await page.screenshot({ path: "test-results/prototipo-ponte.png" });
  // Centralizar Iwazaru antes de cruzar o vão já construído.
  const p = await position(game);
  if (p[0] > 0.3) await walk(page, game, "KeyA", 0, 0.1);
  else if (p[0] < -0.3) await walk(page, game, "KeyD", 0, -0.1, false);
  await walk(page, game, "KeyW", 2, -9.5);
  // Capsule center = soil/bridge surface (1.2) + capsule half-height (0.55).
  await expect.poll(async () => (await position(game))[1]).toBeCloseTo(1.75, 1);
  await walk(page, game, "KeyW", 2, -16);
  await expect.poll(async () => (await position(game))[1]).toBeCloseTo(1.75, 1);
  const revisionBeforeRecovery = Number(
    await game.getAttribute("data-revision"),
  );
  await page.keyboard.press("KeyR");
  await expect(game).toHaveAttribute("data-bridge", "true");
  await expect(game).toHaveAttribute(
    "data-revision",
    String(revisionBeforeRecovery + 1),
  );
  await expect.poll(async () => (await position(game))[1]).toBeCloseTo(1.75, 1);
  // Esc now opens the in-game settings panel instead of leaving outright —
  // exiting is a deliberate click from there.
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Retomar", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair do jogo" }).click();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.getByRole("button", { name: "Retomar ↗" })).toBeVisible();
  await page.getByRole("button", { name: "Retomar ↗" }).click();
  await expect(game).toHaveAttribute("data-bridge", "true");
  expect(errors).toEqual([]);
});
