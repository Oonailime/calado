import { BufferGeometry, Object3D, Mesh, Vector3 } from "three";
import { CHARACTERS } from "../types";
import { CUBIE_POSITIONS, colorForLayer, type Axis, type CubeColor, type GridPos } from "./rubiksCubeState";

export const RUBIKS_CUBE_MODEL_URL = "/assets/models/rubiks-cube/cube.obj";

// CHARACTERS is [Mizaru, Kikazaru, Iwazaru] — their established palette
// (silvery, gold, bronze) already reads as white/yellow/brown, so the puzzle
// reuses those exact tones: a collected piece, and the layer it belongs to,
// glow in the same colour as the monkey who owns it.
export const CUBE_COLOR_HEX: Record<CubeColor, string> = {
  white: CHARACTERS[0].color,
  yellow: CHARACTERS[1].color,
  brown: CHARACTERS[2].color,
};
export const CUBE_CORE_COLOR_HEX = "#2a2a28";

export type CubiePartMaterial = "core" | CubeColor;
export type CubiePart = {
  geometry: BufferGeometry;
  material: CubiePartMaterial;
};
export type ClassifiedCubie = {
  position: GridPos;
  pivot: readonly [number, number, number];
  parts: CubiePart[];
};

function gridCoord(value: number): -1 | 0 | 1 {
  if (Math.abs(value) < 1) return 0;
  return value > 0 ? 1 : -1;
}

function thinAxis(size: Vector3): Axis {
  if (size.x <= size.y && size.x <= size.z) return 0;
  if (size.y <= size.x && size.y <= size.z) return 1;
  return 2;
}

// Every sticker is a thin plate flush with one outer face; every core is
// roughly cubic. That is the only signal classification relies on — never
// the source file's own object names — so a re-export of the reference
// model with different names still classifies correctly.
function isStickerSize(size: Vector3) {
  return size.x < 0.3 || size.y < 0.3 || size.z < 0.3;
}

function meshGridPos(center: Vector3, size: Vector3): GridPos {
  const coords: [number, number, number] = [
    gridCoord(center.x),
    gridCoord(center.y),
    gridCoord(center.z),
  ];
  if (isStickerSize(size)) {
    const axis = thinAxis(size);
    coords[axis] = center.getComponent(axis) > 0 ? 1 : -1;
  }
  return coords;
}

function gridKey(position: GridPos) {
  return position.join(",");
}

/**
 * Splits the flat, ~80-object reference mesh into 26 cubies (one core plate
 * + up to 3 sticker plates each) and works out which of the puzzle's 3 flat
 * colours each cubie should wear, purely from each mesh's own bounding box.
 *
 * Returns plain geometry/colour data rather than live Object3D groups: the
 * source object is cached and reused across mounts by useLoader, so its own
 * mesh tree must never be mutated or reparented — see RubiksCube.tsx, which
 * builds fresh <mesh> instances from this data instead.
 */
export function classifyRubiksCube(source: Object3D): ClassifiedCubie[] {
  const byPosition = new Map<string, { core?: Mesh; stickers: Mesh[] }>();
  const size = new Vector3();
  const center = new Vector3();

  source.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox!;
    bounds.getSize(size);
    bounds.getCenter(center);
    const key = gridKey(meshGridPos(center, size));
    const entry = byPosition.get(key) ?? { stickers: [] };
    if (isStickerSize(size)) entry.stickers.push(mesh);
    else entry.core = mesh;
    byPosition.set(key, entry);
  });

  if (byPosition.size !== 26)
    console.warn(
      `Rubik's cube model: expected 26 cubies, classified ${byPosition.size}.`,
    );

  return CUBIE_POSITIONS.map((position) => {
    const entry = byPosition.get(gridKey(position));
    if (!entry?.core) {
      console.warn(`Rubik's cube model: no geometry found for slot ${gridKey(position)}.`);
      return { position, pivot: [0, 0, 0], parts: [] };
    }
    const pivotVector = entry.core.geometry.boundingBox!.getCenter(new Vector3());
    const pivot: readonly [number, number, number] = [
      pivotVector.x,
      pivotVector.y,
      pivotVector.z,
    ];
    const color = colorForLayer(position[2]);
    const parts: CubiePart[] = [entry.core, ...entry.stickers].map((mesh) => {
      const geometry = mesh.geometry.clone();
      geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
      return { geometry, material: mesh === entry.core ? "core" : color };
    });
    return { position, pivot, parts };
  });
}
