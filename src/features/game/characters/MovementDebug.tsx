import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
} from "three";
import { runtime } from "../state/store";
import type { CharacterId, Vec3 } from "../types";

const LINE_SEGMENTS = 28;
const POINT_CAPACITY = 25;
const LINE_COLORS = (() => {
  const values = new Float32Array(LINE_SEGMENTS * 2 * 3);
  const palette = [
    "#ff4b55", // velocity
    "#4f8dff", // gravity
    "#ffd84d", // radial velocity
    "#54f58a", // tangential velocity
    "#4ff6ff", // forward
    "#ff55dc", // right
    "#ffffff", // up
    "#ff9d3d", // left anchor
    "#ffe65b", // right anchor
    "#ff9d3d", // left arm
    "#ffe65b", // right arm
    "#b46dff", // chosen target
    "#8dd5ff",
    "#8dd5ff",
    "#8dd5ff",
    "#8dd5ff",
    "#8dd5ff",
    "#8dd5ff",
    "#80ffb5", // instantaneous swing-plane normal
    "#fffb8f", // rigid clavicle
    "#fffb8f", // left triangle diagonal
    "#fffb8f", // right triangle diagonal
    "#ff9f68", // left hip pivot
    "#ff9f68", // right hip pivot
    "#86f7ff", // left upper leg
    "#86f7ff", // left lower leg
    "#cf94ff", // right upper leg
    "#cf94ff", // right lower leg
  ];
  palette.forEach((value, index) => {
    const color = new Color(value);
    for (let vertex = 0; vertex < 2; vertex += 1) {
      const offset = (index * 2 + vertex) * 3;
      values[offset] = color.r;
      values[offset + 1] = color.g;
      values[offset + 2] = color.b;
    }
  });
  return values;
})();

function setSegment(
  positions: Float32Array,
  index: number,
  from: Readonly<Vec3>,
  vectorOrEnd: Readonly<Vec3>,
  scale: number,
  isEnd = false,
) {
  const offset = index * 6;
  positions[offset] = from.x;
  positions[offset + 1] = from.y;
  positions[offset + 2] = from.z;
  positions[offset + 3] = isEnd
    ? vectorOrEnd.x
    : from.x + vectorOrEnd.x * scale;
  positions[offset + 4] = isEnd
    ? vectorOrEnd.y
    : from.y + vectorOrEnd.y * scale;
  positions[offset + 5] = isEnd
    ? vectorOrEnd.z
    : from.z + vectorOrEnd.z * scale;
}

function setPoint(
  positions: Float32Array,
  index: number,
  point: Readonly<Vec3>,
) {
  const offset = index * 3;
  positions[offset] = point.x;
  positions[offset + 1] = point.y;
  positions[offset + 2] = point.z;
}

export default function MovementDebug({
  id,
  visible,
}: {
  id: CharacterId;
  visible: boolean;
}) {
  const lineGeometry = useRef<BufferGeometry>(null);
  const pointGeometry = useRef<BufferGeometry>(null);

  useFrame(() => {
    if (!visible || !lineGeometry.current || !pointGeometry.current) return;
    const data = runtime.movementDebug[id];
    const linePosition = lineGeometry.current.getAttribute(
      "position",
    ) as Float32BufferAttribute;
    const linePositions = linePosition.array as Float32Array;
    setSegment(linePositions, 0, data.position, data.velocity, 0.18);
    setSegment(linePositions, 1, data.position, data.gravity, 0.08);
    setSegment(linePositions, 2, data.position, data.radialVelocity, 0.24);
    setSegment(linePositions, 3, data.position, data.tangentialVelocity, 0.24);
    setSegment(linePositions, 4, data.position, data.forward, 0.72);
    setSegment(linePositions, 5, data.position, data.right, 0.72);
    setSegment(linePositions, 6, data.position, data.up, 0.72);
    setSegment(
      linePositions,
      7,
      data.position,
      data.hasLeftAnchor ? data.leftAnchor : data.position,
      1,
      true,
    );
    setSegment(
      linePositions,
      8,
      data.position,
      data.hasRightAnchor ? data.rightAnchor : data.position,
      1,
      true,
    );
    setSegment(linePositions, 9, data.leftShoulder, data.leftHand, 1, true);
    setSegment(linePositions, 10, data.rightShoulder, data.rightHand, 1, true);
    setSegment(
      linePositions,
      11,
      data.position,
      data.hasChosenTarget ? data.chosenTarget : data.position,
      1,
      true,
    );
    for (let index = 0; index < 6; index += 1)
      setSegment(
        linePositions,
        12 + index,
        data.trajectory[index],
        data.trajectory[index + 1],
        1,
        true,
      );
    setSegment(linePositions, 18, data.position, data.swingPlaneNormal, 0.72);
    setSegment(
      linePositions,
      19,
      data.rigLeftShoulder,
      data.rigRightShoulder,
      1,
      true,
    );
    setSegment(
      linePositions,
      20,
      data.rigLeftShoulder,
      data.rigBase,
      1,
      true,
    );
    setSegment(
      linePositions,
      21,
      data.rigRightShoulder,
      data.rigBase,
      1,
      true,
    );
    setSegment(linePositions, 22, data.rigBase, data.rigLeftHip, 1, true);
    setSegment(linePositions, 23, data.rigBase, data.rigRightHip, 1, true);
    setSegment(linePositions, 24, data.rigLeftHip, data.leftKnee, 1, true);
    setSegment(linePositions, 25, data.leftKnee, data.leftFoot, 1, true);
    setSegment(linePositions, 26, data.rigRightHip, data.rightKnee, 1, true);
    setSegment(linePositions, 27, data.rightKnee, data.rightFoot, 1, true);
    linePosition.needsUpdate = true;
    lineGeometry.current.computeBoundingSphere();

    const pointPosition = pointGeometry.current.getAttribute(
      "position",
    ) as Float32BufferAttribute;
    const pointPositions = pointPosition.array as Float32Array;
    let pointCount = 0;
    setPoint(pointPositions, pointCount++, data.position);
    if (data.hasLeftAnchor)
      setPoint(pointPositions, pointCount++, data.leftAnchor);
    if (data.hasRightAnchor)
      setPoint(pointPositions, pointCount++, data.rightAnchor);
    if (data.hasChosenTarget)
      setPoint(pointPositions, pointCount++, data.chosenTarget);
    setPoint(pointPositions, pointCount++, data.rigLeftShoulder);
    setPoint(pointPositions, pointCount++, data.rigRightShoulder);
    setPoint(pointPositions, pointCount++, data.rigBase);
    setPoint(pointPositions, pointCount++, data.rigLeftHip);
    setPoint(pointPositions, pointCount++, data.rigRightHip);
    setPoint(pointPositions, pointCount++, data.leftKnee);
    setPoint(pointPositions, pointCount++, data.rightKnee);
    setPoint(pointPositions, pointCount++, data.leftFoot);
    setPoint(pointPositions, pointCount++, data.rightFoot);
    for (
      let index = 0;
      index < data.candidateCount && pointCount < POINT_CAPACITY;
      index += 1
    )
      setPoint(pointPositions, pointCount++, data.candidates[index]);
    pointGeometry.current.setDrawRange(0, pointCount);
    pointPosition.needsUpdate = true;
    pointGeometry.current.computeBoundingSphere();
  });

  return (
    <group visible={visible} renderOrder={1000}>
      <lineSegments frustumCulled={false}>
        <bufferGeometry ref={lineGeometry}>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(LINE_SEGMENTS * 2 * 3), 3]}
            usage={DynamicDrawUsage}
          />
          <bufferAttribute attach="attributes-color" args={[LINE_COLORS, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          depthTest={false}
          transparent
          opacity={0.92}
        />
      </lineSegments>
      <points frustumCulled={false}>
        <bufferGeometry ref={pointGeometry} drawRange={{ start: 0, count: 0 }}>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array(POINT_CAPACITY * 3), 3]}
            usage={DynamicDrawUsage}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#fff1a8"
          size={0.09}
          sizeAttenuation
          depthTest={false}
        />
      </points>
    </group>
  );
}
