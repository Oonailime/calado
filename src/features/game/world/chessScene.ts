import { Chess, type Move, type PieceSymbol, type Color } from "chess.js";
import { Group, Mesh, MeshStandardMaterial, type BufferGeometry } from "three";
import { gsap } from "gsap";
import { squareToWorldPosition } from "./chessCoordinates";
import { phaseTwoPieceFit, type ChessPieceKind } from "./phaseTwoAssets";
import { PHASE_TWO_CHESS_SCALE } from "./phaseTwoLayout";

const KINDS: Record<PieceSymbol, ChessPieceKind> = {
  p: "pawn",
  r: "rook",
  n: "knight",
  b: "bishop",
  q: "queen",
  k: "king",
};
const activeAnimations = new WeakMap<Mesh, () => void>();
export function animateChessMove(piece: Mesh, from: string, to: string) {
  activeAnimations.get(piece)?.();
  const start = squareToWorldPosition(from),
    end = squareToWorldPosition(to);
  piece.position.copy(start);
  return new Promise<void>((resolve) => {
    const finish = () => {
      activeAnimations.delete(piece);
      resolve();
    };
    const timeline = gsap
      .timeline({ onComplete: finish, onInterrupt: finish })
      .to(piece.position, { y: start.y + 0.12, duration: 0.06 })
      .to(piece.position, {
        x: end.x,
        z: end.z,
        duration: 0.16,
        ease: "power1.inOut",
      })
      .to(piece.position, { y: end.y, duration: 0.06 });
    activeAnimations.set(piece, () => {
      timeline.kill();
      finish();
    });
  });
}
/** A fixed pool of the existing 32 meshes; captures hide, promotions reuse geometry. */
export class ChessScene {
  readonly group = new Group();
  private materials = [
    new MeshStandardMaterial({ color: "#f2ede2", roughness: 0.82 }),
    new MeshStandardMaterial({ color: "#4a2f1c", roughness: 0.82 }),
  ];
  private pool: Mesh[] = [];
  private squares = new Map<string, Mesh>();
  private generation = 0;
  constructor(private geometries: Record<ChessPieceKind, BufferGeometry>) {
    this.group.name = "phase2-chess-pieces";
    for (let i = 0; i < 32; i++) {
      const mesh = new Mesh(geometries.pawn, this.materials[i < 16 ? 0 : 1]);
      mesh.userData.color = i < 16 ? "w" : "b";
      mesh.userData.cameraOccluder = false;
      mesh.castShadow = true;
      this.pool.push(mesh);
      this.group.add(mesh);
    }
  }
  syncFromFen(fen: string) {
    const board = new Chess(fen)
      .board()
      .flat()
      .filter((p) => p !== null);
    const used = new Set<Mesh>(),
      next = new Map<string, Mesh>();
    for (const piece of board) {
      const existing = this.squares.get(piece.square);
      if (existing?.userData.color === piece.color) {
        used.add(existing);
        next.set(piece.square, existing);
      }
    }
    for (const piece of board) {
      const mesh =
        next.get(piece.square) ??
        this.pool.find(
          (m) => !used.has(m) && m.userData.color === piece.color,
        )!;
      used.add(mesh);
      next.set(piece.square, mesh);
      const kind = KINDS[piece.type],
        geometry = this.geometries[kind],
        fit = phaseTwoPieceFit(geometry, kind);
      mesh.geometry = geometry;
      // createPhaseTwoChess's own static pieces apply this same fit
      // directly, then get PHASE_TWO_CHESS_SCALE applied uniformly to the
      // whole merged board afterward (see its final result.scale(...) call).
      // These pieces are separate meshes, not part of that merge, so they
      // need the multiplier applied here instead to end up the same size.
      mesh.scale.set(
        fit.horizontal * PHASE_TWO_CHESS_SCALE,
        fit.vertical * PHASE_TWO_CHESS_SCALE,
        fit.horizontal * PHASE_TWO_CHESS_SCALE,
      );
      mesh.position.copy(squareToWorldPosition(piece.square));
      mesh.rotation.y = (piece.color as Color) === "b" ? Math.PI : 0;
      mesh.userData.square = piece.square;
    }
    for (const mesh of this.pool) mesh.visible = used.has(mesh);
    this.squares = next;
    this.group.userData.fen = fen;
  }
  async animate(move: Move) {
    const generation = this.generation;
    const mesh = this.squares.get(move.from);
    if (!mesh) return;
    const capturedSquare = move.isEnPassant()
      ? `${move.to[0]}${move.from[1]}`
      : move.to;
    const captured = this.squares.get(capturedSquare);
    if (captured) {
      captured.visible = false;
      this.squares.delete(capturedSquare);
    }
    const jobs = [animateChessMove(mesh, move.from, move.to)];
    this.squares.delete(move.from);
    this.squares.set(move.to, mesh);
    if (move.isKingsideCastle() || move.isQueensideCastle()) {
      const from = `${move.isKingsideCastle() ? "h" : "a"}${move.from[1]}`,
        to = `${move.isKingsideCastle() ? "f" : "d"}${move.from[1]}`;
      const rook = this.squares.get(from);
      if (rook) {
        jobs.push(animateChessMove(rook, from, to));
        this.squares.delete(from);
        this.squares.set(to, rook);
      }
    }
    await Promise.all(jobs);
    if (generation === this.generation) this.syncFromFen(move.after);
  }
  cancel() {
    this.generation++;
    for (const mesh of this.pool) activeAnimations.get(mesh)?.();
  }
  dispose() {
    this.cancel();
    this.materials.forEach((m) => m.dispose());
  }
}
