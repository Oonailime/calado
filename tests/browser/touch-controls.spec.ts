import { test, expect } from "@playwright/test";

test("história móvel cabe em retrato e paisagem", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Versão mobile em desenvolvimento" })).toBeVisible();
  await page.getByRole("button", { name: /Estou ciente/ }).click();
  await expect(page.getByRole("dialog", { name: "Vire o celular" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Preparando a jornada…")).toBeHidden({ timeout: 45_000 });
  await page.waitForTimeout(900);
  await expect.poll(() => page.evaluate(() => {
    const scene = (window as unknown as { __storyTest?: { gl: { getPixelRatio: () => number } } }).__storyTest;
    return scene?.gl.getPixelRatio() ?? 2;
  })).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mobile-story-portrait.png" });
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.56));
  await expect(page.getByRole("heading", { name: "Projetos selecionados" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mobile-portfolio-portrait.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/mobile-story-landscape.png" });
  await page.getByRole("button", { name: "Modo escuro" }).click();
  await expect(page.getByText("Preparando a jornada…")).toBeHidden({ timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => {
    const scene = (window as unknown as { __storyTest?: { gl: { getPixelRatio: () => number } } }).__storyTest;
    return scene?.gl.getPixelRatio() ?? 2;
  })).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "test-results/mobile-story-volcanic.png" });
  await context.close();
});

test("jogo móvel oferece controles em paisagem e aviso em retrato", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/?map=phase3");
  await page.getByRole("button", { name: /Estou ciente/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  const game = page.getByRole("region", { name: "Ambiente jogável" });
  await expect(game).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await expect(game).toHaveAttribute("data-portrait", "true");
  await expect(page.getByText("Vire o celular para jogar na horizontal")).toBeVisible();
  await expect(page.getByLabel("Mover")).toHaveCount(0);
  await page.screenshot({ path: "test-results/mobile-game-portrait.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByText("Vire o celular para jogar na horizontal")).toBeHidden();
  await expect(game).toHaveAttribute("data-portrait", "false");
  await expect(page.getByLabel("Mover")).toBeVisible();
  await expect(page.getByRole("button", { name: "Agarrar / interagir" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Habilidade" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pular" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
  // Guidance waits behind the one help button until the player asks for it.
  await expect(page.getByRole("region", { name: "Ajuda" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ajuda" }).click();
  await expect(page.getByRole("region", { name: "Ajuda" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar ajuda" }).click();
  await expect(page.getByRole("region", { name: "Ajuda" })).toHaveCount(0);
  const joystick = await page.getByLabel("Mover").boundingBox();
  const view = await page.getByLabel("Arraste para girar a câmera; pince para zoom").boundingBox();
  expect(joystick).not.toBeNull();
  expect(view).not.toBeNull();
  if (joystick && view) {
    const before = await page.evaluate(() => (window as unknown as { __game: { runtime: { yaw: number } } }).__game.runtime.yaw);
    const cdp = await context.newCDPSession(page);
    const left = { x: joystick.x + joystick.width / 2, y: joystick.y + joystick.height / 2, id: 1 };
    const right = { x: view.x + view.width - 160, y: view.y + 140, id: 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [left, right] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...left, y: left.y - 45 }, { ...right, x: right.x + 90 }] });
    await expect.poll(() => page.evaluate(() => [...(window as unknown as { __game: { runtime: { keys: Set<string> } } }).__game.runtime.keys])).toContain("KeyW");
    await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { runtime: { yaw: number } } }).__game.runtime.yaw)).not.toBe(before);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => [...(window as unknown as { __game: { runtime: { keys: Set<string> } } }).__game.runtime.keys])).not.toContain("KeyW");
    const zoomBefore = await page.evaluate(() => (window as unknown as { __game: { runtime: { zoom: number } } }).__game.runtime.zoom);
    const first = { x: view.x + view.width - 170, y: view.y + 140, id: 3 };
    const second = { x: view.x + view.width - 100, y: view.y + 140, id: 4 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, second] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [first, { ...second, x: second.x + 70 }] });
    await expect.poll(() => page.evaluate(() => (window as unknown as { __game: { runtime: { zoom: number } } }).__game.runtime.zoom)).toBeLessThan(zoomBefore);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // The camera button pulls the view back and, pressed again, returns it.
    const zoom = () => page.evaluate(() => (window as unknown as { __game: { runtime: { zoom: number } } }).__game.runtime.zoom);
    const pinched = await zoom();
    const camera = page.getByRole("button", { name: "Afastar câmera" });
    await camera.tap();
    await expect(camera).toHaveAttribute("aria-pressed", "true");
    expect(await zoom()).toBeCloseTo(1.6);
    await camera.tap();
    await expect(camera).toHaveAttribute("aria-pressed", "false");
    expect(await zoom()).toBeCloseTo(pinched);
    for (const [label, code] of [["Pular", "Space"], ["Agarrar / interagir", "KeyE"], ["Habilidade", "KeyF"]] as const) {
      const button = await page.getByRole("button", { name: label }).boundingBox();
      expect(button).not.toBeNull();
      if (!button) continue;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: button.x + button.width / 2, y: button.y + button.height / 2, id: 5 }] });
      await expect.poll(() => page.evaluate(key => (window as unknown as { __game: { runtime: { keys: Set<string> } } }).__game.runtime.keys.has(key), code)).toBe(true);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await page.evaluate(() => {
      const game = (window as unknown as { __game: { runtime: { motions: (string | null)[] }; useGame: { getState: () => { select: (id: number) => void } } } }).__game;
      game.useGame.getState().select(2);
      (window as unknown as { __forceVine?: number }).__forceVine = window.setInterval(() => { game.runtime.motions[2] = "vine-swing"; }, 1);
    });
    await expect(page.getByRole("button", { name: "Subir" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Descer" })).toBeVisible();
    for (const [label, code] of [["Subir", "ShiftLeft"], ["Descer", "AltLeft"]] as const) {
      const button = await page.getByRole("button", { name: label }).boundingBox();
      expect(button).not.toBeNull();
      if (!button) continue;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: button.x + button.width / 2, y: button.y + button.height / 2, id: 6 }] });
      await expect.poll(() => page.evaluate(key => (window as unknown as { __game: { runtime: { keys: Set<string> } } }).__game.runtime.keys.has(key), code)).toBe(true);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await page.evaluate(() => window.clearInterval((window as unknown as { __forceVine?: number }).__forceVine));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(game).toHaveAttribute("data-portrait", "true");
  await expect(page.getByLabel("Mover")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => [...(window as unknown as { __game: { runtime: { keys: Set<string> } } }).__game.runtime.keys])).toEqual([]);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(game).toHaveAttribute("data-portrait", "false");
  await expect(page.getByLabel("Mover")).toBeVisible();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.screenshot({ path: "test-results/mobile-game-landscape.png" });
  await page.evaluate(() => (window as unknown as { __game: { useGame: { getState: () => { configure: (patch: object) => void } } } }).__game.useGame.getState().configure({ cubePuzzleOpen: true }));
  await expect(page.getByRole("button", { name: "Fechar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByRole("dialog", { name: "Configurações de controles" })).toBeVisible();
  await expect(page.getByLabel("Qualidade gráfica")).toHaveValue("low");
  await page.getByRole("button", { name: "Sair do jogo" }).click();
  await expect(page.getByText("Preparando a jornada…")).toBeHidden({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: "Meu nome é Emiliano Calado." })).toBeVisible();
  await context.close();
});

test("ilhas carregam a bananeira comprimida no toque", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto("/?skip");
  await page.getByRole("button", { name: /Estou ciente/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  const game = page.getByRole("region", { name: "Ambiente jogável" });
  await expect(game).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  expect(requests.some(url => url.endsWith("/PlantWithBananas.glb"))).toBe(true);
  expect(requests.some(url => url.endsWith("/PlantWithBananas.fbx"))).toBe(false);
  await page.evaluate(() => (window as unknown as { __game: { useGame: { getState: () => { configure: (patch: object) => void } } } }).__game.useGame.getState().configure({ lockOpen: true }));
  await expect(page.getByRole("dialog", { name: "Cadeado do totem" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aumentar algarismo" })).toBeVisible();
  await page.getByRole("button", { name: "Aumentar algarismo" }).click();
  await expect(page.getByRole("button", { name: "Confirmar" })).toBeVisible();
  await context.close();
});

test("joystick aparece com toque mesmo se o ponteiro principal é preciso", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/?skip");
  await expect(page.getByRole("dialog", { name: "Versão mobile em desenvolvimento" })).toBeVisible();
  await page.getByRole("button", { name: /Estou ciente/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  const game = page.getByRole("region", { name: "Ambiente jogável" });
  await expect(game).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await expect(game).toHaveAttribute("data-touch", "true");
  await expect(page.getByLabel("Mover")).toBeVisible();
  await context.close();
});

test("fase 2 no toque: câmera próxima e xadrez dentro da ajuda", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/?map=phase2");
  await page.getByRole("button", { name: /Estou ciente/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("region", { name: "Ambiente jogável" })).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  // A phone keeps the close framing at rest; the wide valley view is a pinch away.
  await expect.poll(() => page.evaluate(() => {
    const w = window as unknown as {
      __canopyTest: { camera: { position: { x: number; y: number; z: number } } };
      __game: { runtime: { positions: { x: number; y: number; z: number }[] }; useGame: { getState: () => { puzzle: { selected: number } } } };
    };
    const monkey = w.__game.runtime.positions[w.__game.useGame.getState().puzzle.selected];
    const camera = w.__canopyTest.camera.position;
    return Math.hypot(camera.x - monkey.x, camera.y - monkey.y, camera.z - monkey.z);
  })).toBeLessThan(15);
  await expect(page.getByRole("region", { name: "Instruções de xadrez" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Ajuda" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ajuda" }).click();
  await expect(page.getByRole("region", { name: "Ajuda" })).toContainText("Fase 2 · Xadrez");
  await page.getByRole("button", { name: "Fechar ajuda" }).click();
  await expect(page.getByRole("region", { name: "Ajuda" })).toHaveCount(0);
  await context.close();
});

test("desktop conserva a bananeira original e os controles de mouse", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", request => requests.push(request.url()));
  await page.goto("/?skip");
  await expect(page.getByRole("region", { name: "Ambiente jogável" })).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  expect(requests.some(url => url.endsWith("/PlantWithBananas.fbx"))).toBe(true);
  expect(requests.some(url => url.endsWith("/PlantWithBananas.glb"))).toBe(false);
  await expect(page.getByLabel("Mover")).toHaveCount(0);
  // The movement debug tool needs ?debug, like ?skip.
  await expect(page.getByRole("button", { name: "Debug de movimentação" })).toHaveCount(0);
});

test("ferramenta de debug aparece só com ?debug", async ({ page }) => {
  await page.goto("/?skip&debug");
  await expect(page.getByRole("region", { name: "Ambiente jogável" })).toHaveAttribute("data-ready", "true", { timeout: 90_000 });
  await page.getByRole("button", { name: "Debug de movimentação" }).click();
  await expect(page.locator("pre")).toContainText("fps");
});

test("celular sem API de tela cheia explica a Tela de Início", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  // An iPhone's Safari has no fullscreen API for pages.
  await context.addInitScript(() => Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false }));
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await page.getByRole("button", { name: /Estou ciente/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Tela cheia" }).click();
  await expect(page.getByRole("dialog", { name: "Tela cheia pela Tela de Início" })).toBeVisible();
  await page.getByRole("button", { name: "Entendi" }).click();
  await expect(page.getByRole("dialog", { name: "Tela cheia pela Tela de Início" })).toHaveCount(0);
  await context.close();
});
