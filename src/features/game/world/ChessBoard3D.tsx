"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { BufferGeometry } from "three";
import { phase2Chess } from "./phase2Chess";
import { squareToWorldPosition, worldToSquare } from "./chessCoordinates";
import type { ChessPieceKind } from "./phaseTwoAssets";
import { PHASE_TWO_CHESS_SCALE, PHASE_TWO_TABLE } from "./phaseTwoLayout";
import { ChessScene } from "./chessScene";

export default function ChessBoard3D({
  pieces,
}: {
  pieces: Record<ChessPieceKind, BufferGeometry>;
}) {
  const state = useSyncExternalStore(
    phase2Chess.subscribe,
    phase2Chess.getSnapshot,
    phase2Chess.getSnapshot,
  );
  const scene = useMemo(() => new ChessScene(pieces), [pieces]);
  useEffect(() => {
    scene.cancel();
    scene.syncFromFen(phase2Chess.getSnapshot().fen);
  }, [scene, state.revision]);
  useEffect(
    () => phase2Chess.registerAnimator((move) => scene.animate(move)),
    [scene],
  );
  useEffect(() => () => scene.dispose(), [scene]);
  return (
    <group name="phase2-chess-interaction">
      <primitive
        object={scene.group}
        onPointerDown={(event: {
          stopPropagation: () => void;
          object: { userData: { square?: string } };
        }) => {
          event.stopPropagation();
          if (event.object.userData.square)
            void phase2Chess.choose(event.object.userData.square);
        }}
      />
      {/* One picking surface; only highlighted squares need a draw call. */}
      <mesh
        position={[PHASE_TWO_TABLE[0], squareToWorldPosition("a1").y - 0.012, PHASE_TWO_TABLE[1]]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(event) => {
          event.stopPropagation();
          const square = worldToSquare(event.point.x, event.point.z);
          if (square) void phase2Chess.choose(square);
        }}
      >
        <planeGeometry args={[2.4 * PHASE_TWO_CHESS_SCALE, 2.4 * PHASE_TWO_CHESS_SCALE]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {[...new Set([...(state.selected ? [state.selected] : []), ...state.legalTargets])]
        .map((square) => {
          const p = squareToWorldPosition(square),
            selected = state.selected === square,
            legal = state.legalTargets.includes(square as never),
            capture = state.captureTargets.includes(square as never);
          return (
            <mesh
              key={square}
              position={[p.x, p.y - 0.005, p.z]}
              onPointerDown={(event) => {
                event.stopPropagation();
                void phase2Chess.choose(square);
              }}
            >
              <boxGeometry
                args={[
                  0.3 * PHASE_TWO_CHESS_SCALE,
                  0.01,
                  0.3 * PHASE_TWO_CHESS_SCALE,
                ]}
              />
              <meshBasicMaterial
                transparent
                opacity={selected ? 0.5 : capture ? 0.5 : legal ? 0.35 : 0}
                color={capture ? "#ed6b5d" : selected ? "#ffe082" : "#76d6ff"}
                depthWrite={false}
              />
            </mesh>
          );
        })}
    </group>
  );
}
