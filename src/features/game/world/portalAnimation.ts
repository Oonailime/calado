export const PORTAL_BUILD_DURATION = 6;
export const PORTAL_SOLID_END = 0.82;
export const PORTAL_LETTERS = ["K", "M", "I"] as const;

export function advancePortalConstruction(
  progress: number,
  delta: number,
  built: boolean,
  running: boolean,
  reduced: boolean,
) {
  if (!built) return 0;
  if (reduced) return 1;
  if (!running) return progress;
  return Math.min(1, progress + Math.max(0, delta) / PORTAL_BUILD_DURATION);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function portalPieceProgress(
  index: number,
  total: number,
  constructionProgress: number,
) {
  const pieceWindow = 0.18;
  const lastStart = PORTAL_SOLID_END - pieceWindow;
  const start = total <= 1 ? 0 : clamp01(index / (total - 1)) * lastStart;
  return clamp01((constructionProgress - start) / pieceWindow);
}

export function portalActivationProgress(constructionProgress: number) {
  return clamp01(
    (constructionProgress - PORTAL_SOLID_END) / (1 - PORTAL_SOLID_END),
  );
}

export function portalPartOrder(name: string) {
  if (name === "Foundation") return 0;
  const floor = name.match(/^FloorPaver_(\d+)$/);
  if (floor) return 10 + Number(floor[1]);
  const pillar = name.match(/^Pillar_([LR])_(\d+)$/);
  if (pillar) return 100 + Number(pillar[2]) * 2 + (pillar[1] === "R" ? 1 : 0);
  if (name.startsWith("Shoulder_")) return 200;
  const arch = name.match(/^ArchStone_(\d+)$/);
  if (arch) return 210 + Number(arch[1]);
  if (name.startsWith("RunePlaque_")) return 300;
  return 250;
}

export function isOriginalPortalRune(name: string) {
  return /^(RuneTop|RuneLeft|RuneRight|RuneDot)_/.test(name);
}
