import { Vector3 } from "three";
import { WORLD_GRAVITY } from "./locomotionConfig";

// A direct TypeScript port of the reference project's Verlet.cs: a simple
// particle/distance-constraint physics system where velocity is implied by
// the delta between the current and previous position (Jakobsen, "Advanced
// Character Physics"), rather than stored explicitly. See
// assets/moves/.../Reference/verlet_character_physics.pdf for the source
// algorithm and assets/moves/.../VerletSystem.cs for the original C#.
export type VerletPoint = {
  name: string;
  pos: Vector3;
  oldPos: Vector3;
  temp: Vector3;
  mass: number;
  pinned: boolean;
};

export type VerletBone = {
  name: string;
  a: number;
  b: number;
  /** [minLength, maxLength] - a range, not a fixed length, matching the source. */
  length: [number, number];
  enabled: boolean;
};

export class VerletSystem {
  points: VerletPoint[] = [];
  bones: VerletBone[] = [];

  addPoint(pos: Vector3, name: string): number {
    this.points.push({
      name,
      pos: pos.clone(),
      oldPos: pos.clone(),
      temp: pos.clone(),
      mass: 1,
      pinned: false,
    });
    return this.points.length - 1;
  }

  addBone(name: string, a: number, b: number, maxLength?: number): void {
    const length =
      maxLength ?? this.points[b].pos.distanceTo(this.points[a].pos);
    this.bones.push({ name, a, b, length: [length, length], enabled: true });
  }

  startSim(step: number): void {
    const timeSquared = step * step;
    for (const point of this.points) {
      point.temp.copy(point.pos);
      if (!point.pinned) {
        // pos += (pos - oldPos) + gravity * dt^2
        const vx = point.pos.x - point.oldPos.x + WORLD_GRAVITY.x * timeSquared;
        const vy = point.pos.y - point.oldPos.y + WORLD_GRAVITY.y * timeSquared;
        const vz = point.pos.z - point.oldPos.z + WORLD_GRAVITY.z * timeSquared;
        point.pos.set(point.pos.x + vx, point.pos.y + vy, point.pos.z + vz);
      }
    }
  }

  enforceDistanceConstraints(): void {
    for (const bone of this.bones) {
      if (!bone.enabled) continue;
      const a = this.points[bone.a];
      const b = this.points[bone.b];
      const pinnedCount = (a.pinned ? 1 : 0) + (b.pinned ? 1 : 0);
      if (pinnedCount >= 2) continue;
      const currentLength = a.pos.distanceTo(b.pos);
      if (currentLength === 0) continue;
      const [minLength, maxLength] = bone.length;
      if (pinnedCount === 1) {
        const pinned = a.pinned ? a : b;
        const free = a.pinned ? b : a;
        if (currentLength < minLength || currentLength > maxLength) {
          const clamped = currentLength < minLength ? minLength : maxLength;
          free.pos
            .sub(pinned.pos)
            .multiplyScalar(clamped / currentLength)
            .add(pinned.pos);
        }
      } else if (currentLength < minLength || currentLength > maxLength) {
        const clamped = currentLength < minLength ? minLength : maxLength;
        const relMass = b.mass / (a.mass + b.mass);
        const midX = a.pos.x * (1 - relMass) + b.pos.x * relMass;
        const midY = a.pos.y * (1 - relMass) + b.pos.y * relMass;
        const midZ = a.pos.z * (1 - relMass) + b.pos.z * relMass;
        const offX = (b.pos.x - a.pos.x) / currentLength;
        const offY = (b.pos.y - a.pos.y) / currentLength;
        const offZ = (b.pos.z - a.pos.z) / currentLength;
        a.pos.set(
          midX - offX * clamped * relMass,
          midY - offY * clamped * relMass,
          midZ - offZ * clamped * relMass,
        );
        b.pos.set(
          midX + offX * clamped * (1 - relMass),
          midY + offY * clamped * (1 - relMass),
          midZ + offZ * clamped * (1 - relMass),
        );
      }
    }
  }

  endSim(): void {
    for (const point of this.points) point.oldPos.copy(point.temp);
  }

  step(step: number): void {
    this.startSim(step);
    this.enforceDistanceConstraints();
    this.endSim();
  }
}
