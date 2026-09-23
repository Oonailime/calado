import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { Chess } from "chess.js";
import {
  PHASE_TWO_STOOLS,
  phaseTwoGroundHeight,
} from "../../src/features/game/world/phaseTwoLayout";

// Use the machine's GPU for this full scene; the Worker test itself needs no WebGL.
test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args: [process.platform === "win32" ? "--use-angle=d3d11" : "--use-gl=angle", "--disable-dev-shm-usage"],
  },
});

async function seatMonkey(page: Page, id: number, index: number) {
    const game = page.getByRole("region", { name: "Ambiente jogável" });
    const anchor = PHASE_TWO_STOOLS[index];
    await page.evaluate(
      ({ id, anchor, y }) => {
        const { runtime, useGame } = (
          window as unknown as {
            __game: {
              runtime: { phase2Restore: unknown[] };
              useGame: {
                getState: () => {
                  select: (id: number) => void;
                  configure: (s: object) => void;
                };
              };
            };
          }
        ).__game;
        useGame.getState().configure({ paused: false });
        useGame.getState().select(id);
        runtime.phase2Restore[id] = { x: anchor.x + 0.75, y, z: anchor.z };
      },
      { id, anchor, y: phaseTwoGroundHeight(anchor.x + 0.75, anchor.z) + 0.65 },
    );
    await expect(game).toHaveAttribute("data-chess-seat-indicators", index === 0 ? "true,false" : "false,true");
    await page.keyboard.press("KeyE");
    await expect(game).toHaveAttribute("data-chess-seat-indicators", "false,false");
  }

test("real WASM Worker supports all NPC strengths, cancellation and a new game", async ({
  page,
}) => {
  await page.route("**/__chess-engine-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Worker validation</body></html>",
    }),
  );
  await page.goto("/__chess-engine-test");
  const source = readFileSync(
    "src/features/game/world/stockfishEngine.ts",
    "utf8",
  );
  const bundle = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  await page.addScriptTag({
    content: `(() => { const exports = {}; ${bundle}; window.ChessEngine = exports; })();`,
  });
  const results = await page.evaluate(async (fen) => {
    const { StockfishEngine } = (
      window as unknown as {
        ChessEngine: typeof import("../../src/features/game/world/stockfishEngine");
      }
    ).ChessEngine;
    const results = [];
    for (const elo of [800, 1600, 2000] as const) {
      const engine = new StockfishEngine();
      engine.setElo(elo);
      const move = await engine.getBestMove(fen);
      results.push({ elo, actual: engine.effectiveElo, move });
      engine.dispose();
    }
    const engine = new StockfishEngine();
    await engine.initialize();
    const pending = engine.getBestMove(fen).then(
      () => false,
      () => true,
    );
    await Promise.resolve();
    engine.stop();
    if (!(await pending))
      throw new Error("Cancellation did not reject pending search");
    const move = await engine.getBestMove(fen);
    engine.dispose();
    results.push({ elo: 800, actual: engine.effectiveElo, move });
    return results;
  }, new Chess().fen());
  for (const result of results) {
    const chess = new Chess();
    expect(
      chess.move({
        from: result.move.slice(0, 2),
        to: result.move.slice(2, 4),
        promotion: result.move[4],
      }),
    ).toBeTruthy();
    expect(result.actual).toBeGreaterThanOrEqual(result.elo);
  }
  console.log("Stockfish strengths:", results);
});

test("chess tab solves the puzzle, restores monkeys, persists and starts free games on either side", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors: string[] = [],
    engineRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("stockfish")) engineRequests.push(request.url());
  });
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.addInitScript(() => localStorage.setItem("phase2ChessPieces", "[true,true,true]"));
  await page.goto("/?map=phase2");
  const game = page.getByRole("region", { name: "Ambiente jogável" });
  await expect(game).toHaveAttribute("data-ready", "true", { timeout: 90000 });
  await expect(game).toHaveAttribute("data-chess-seat-indicators", "false,false");
  const instructions = page.getByRole("region", { name: "Instruções de xadrez" });
  await expect(instructions.getByRole("button")).toHaveCount(0);
  const seat = (id: number, index: number) => seatMonkey(page, id, index);
  await seat(0, 0);
  await expect(
    page.getByText("Tal × Gulko, após 21…Kf8.", { exact: false }),
  ).toBeVisible();
  const tab = page.getByRole("region", {
    name: "Xadrez — tabuleiro representativo",
  });
  async function clickSquare(square: string) {
    await tab.getByRole("button", { name: square, exact: true }).click();
  }
  const cell = (square: string) =>
    tab.getByRole("button", { name: square, exact: true });
  await expect(cell("e5")).toHaveAttribute("data-piece", "wq");
  await expect(tab.locator("[data-chess-files] span")).toHaveText(["A", "B", "C", "D", "E", "F", "G", "H"]);
  await expect(tab.locator("[data-chess-ranks] span")).toHaveText(["8", "7", "6", "5", "4", "3", "2", "1"]);
  await expect(tab.locator("[data-square] small")).toHaveCount(0);
  await expect(tab.getByText("Lance em andamento…")).toHaveCount(0);
  console.log("Renderer:", await game.locator("canvas").evaluate(canvas => {
    const gl = (canvas as HTMLCanvasElement).getContext("webgl2")!;
    return gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info")!.UNMASKED_RENDERER_WEBGL);
  }));
  const baselineTimes = await page.evaluate(async () => {
    const times: number[] = [];
    let previous = performance.now();
    for (let i = 0; i < 16; i++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const now = performance.now();
      times.push(now - previous);
      previous = now;
    }
    return times;
  });
  console.log("Baseline frame times (ms):", baselineTimes);
  const responseTimes = await page.evaluate(async () => {
    const times: number[] = [];
    for (let i = 0; i < 16; i++) {
      const button = document.querySelector<HTMLButtonElement>(`[data-chess-tab] [data-square="${i % 2 ? "h5" : "g1"}"]`)!;
      const start = performance.now();
      button.click();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (button.getAttribute("aria-pressed") !== "true") throw new Error("Selection did not update on the next frame");
      times.push(performance.now() - start);
    }
    return times;
  });
  await test.info().attach("chess-selection-latency.json", { body: JSON.stringify({ baselineTimes, responseTimes }), contentType: "application/json" });
  console.log("Chess selection latency (ms):", responseTimes);
  expect(Math.max(...responseTimes)).toBeLessThan(300);
  await page.screenshot({ path: "test-results/chess-puzzle-start.png" });
  await clickSquare("g1");
  await clickSquare("g7");
  await expect(page.getByText("Boa! Encontre", { exact: false })).toBeVisible();
  await expect(cell("g7")).toHaveAttribute("data-piece", "wr");
  await expect(cell("e5")).toHaveAttribute("data-piece", "bp");
  await expect
    .poll(
      async () =>
        new Chess((await game.getAttribute("data-chess-visual-fen"))!).get("g7")
          ?.type,
    )
    .toBe("r");
  await clickSquare("g7");
  await clickSquare("g8");
  await expect(
    page.getByText("A combinação exige", { exact: false }),
  ).toBeVisible();
  await expect(cell("g7")).toHaveAttribute("data-piece", "wr");
  await tab.getByRole("button", { name: "Reiniciar" }).click();
  await expect(cell("g1")).toHaveAttribute("data-piece", "wr");
  await expect(cell("e5")).toHaveAttribute("data-piece", "wq");
  await expect(tab.locator("[data-chess-files] span")).toHaveText(["A", "B", "C", "D", "E", "F", "G", "H"]);
  await expect(tab.locator("[data-chess-ranks] span")).toHaveText(["8", "7", "6", "5", "4", "3", "2", "1"]);
  await expect(tab.locator("[data-square] small")).toHaveCount(0);
  await clickSquare("g1");
  await clickSquare("g7");
  for (const [from, to] of [
    ["g7", "f7"],
    ["f7", "e7"],
    ["d1", "f1"],
    ["f1", "f7"],
  ]) {
    await clickSquare(from);
    await clickSquare(to);
  }
  await expect(
    page.getByText("Combinação concluída!", { exact: false }),
  ).toBeVisible();
  await expect(cell("f7")).toHaveAttribute("data-piece", "wr");
  await expect(cell("e7")).toHaveAttribute("data-piece", "wr");
  await expect
    .poll(
      async () =>
        new Chess((await game.getAttribute("data-chess-visual-fen"))!).get("f7")
          ?.type,
    )
    .toBe("r");
  const seated = JSON.parse((await game.getAttribute("data-chess-seats"))!) as {
    id: number;
    position: number[];
    pelvis: number[];
  }[];
  expect(seated[1]).toBeNull();
  seated.forEach((seat, index) => {
    if (!seat) return;
    expect(seat.position[0]).toBeCloseTo(PHASE_TWO_STOOLS[index].x, 2);
    expect(seat.position[2]).toBeCloseTo(PHASE_TWO_STOOLS[index].z, 2);
    expect(seat.pelvis[0]).toBeCloseTo(PHASE_TWO_STOOLS[index].x, 2);
    expect(seat.pelvis[2]).toBeCloseTo(PHASE_TWO_STOOLS[index].z, 2);
  });
  expect(engineRequests).toHaveLength(0);
  await page.screenshot({ path: "test-results/chess-puzzle-completed.png" });
  await expect(game).toHaveAttribute("data-map", "phase2");
  await page.getByRole("button", { name: "Sair da mesa" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as {
            __game: {
              runtime: { chessActive: boolean; phase2Seats: unknown[] };
            };
          }
        ).__game.runtime.phase2Seats.every((s) => s === null),
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(game).toHaveAttribute("data-ready", "true", { timeout: 90000 });
  await expect(instructions).toContainText("jogar contra os outros macacos");
  await seat(2, 0);
  await seat(0, 1);
  await expect(tab).toBeVisible();
  await expect(cell("e7")).toBeEnabled({ timeout: 40000 });
  await expect(tab.getByText("Você: pretas", { exact: false })).toBeVisible();
  await expect(tab.locator("[data-chess-files] span")).toHaveText(["H", "G", "F", "E", "D", "C", "B", "A"]);
  await expect(tab.locator("[data-chess-ranks] span")).toHaveText(["1", "2", "3", "4", "5", "6", "7", "8"]);
  await expect(tab.locator("[data-square]").first()).toHaveAttribute(
    "data-square",
    "h1",
  );
  await clickSquare("e7");
  await clickSquare("e5");
  await page.getByRole("button", { name: "Sair da mesa" }).click();
  await expect(tab).not.toBeVisible();

  await seat(1, 1);
  await seat(2, 0);
  await expect(tab.getByText("Você: brancas", { exact: false })).toBeVisible();
  await expect(cell("e2")).toHaveAttribute("data-piece", "wp");
  await clickSquare("e2");
  await clickSquare("e4");
  await expect(cell("e4")).toBeEnabled();
  await expect(cell("e4")).toHaveAttribute("data-piece", "wp");
  await page.getByRole("button", { name: "Sair da mesa" }).click();
  expect(engineRequests.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});


test("winning against each monkey adds a different trophy to the inventory and survives reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("historicalChessPuzzleSolved", "true"));
  // Deterministic opponent: the player still wins through legal board clicks.
  await page.route("**/assets/stockfish/stockfish-19-lite-single.js", route => route.fulfill({
    contentType: "application/javascript",
    body: `let ply = 0; onmessage = ({ data }) => {
      if (data === "uci") postMessage("uciok");
      if (data === "isready") postMessage("readyok");
      if (data.startsWith("go ")) postMessage("bestmove " + ["f2f3", "g2g4"][ply++]);
    };`,
  }));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem("phase2ChessPieces", "[true,true,true]"));
  await page.goto("/?map=phase2");
  const game = page.getByRole("region", { name: "Ambiente jogável" });
  await expect(game).toHaveAttribute("data-ready", "true", { timeout: 90000 });
  const inventory = page.getByRole("group", { name: "Inventário", exact: true });
  const tab = page.getByRole("region", { name: "Xadrez — tabuleiro representativo" });
  for (const [id, name] of [[0, "mizaru"], [1, "kikazaru"], [2, "iwazaru"]] as const) {

    await seatMonkey(page, id, 0);
    await seatMonkey(page, (id + 1) % 3, 1);
    for (const square of ["e7", "e5", "d8", "h4"]) {
      await tab.getByRole("button", { name: square, exact: true }).click();
    }
    await expect(tab.getByRole("status")).toContainText("Você venceu");
    await expect(inventory.locator(`[data-item="chess-${name}"]`)).toBeVisible();
    await expect(inventory.locator('[data-item^="chess-"]')).toHaveCount(id + 1);
    await page.getByRole("button", { name: "Sair do xadrez", exact: true }).click();
  }
  await page.screenshot({ path: "test-results/chess-trophy-inventory.png" });
  await page.reload();
  await expect(game).toHaveAttribute("data-ready", "true", { timeout: 90000 });
  await expect(inventory.locator('[data-item^="chess-"]')).toHaveCount(3);
  expect(errors).toEqual([]);
});
