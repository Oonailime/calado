"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import {
  CatmullRomCurve3,
  DoubleSide,
  Group,
  ShaderMaterial,
  MeshStandardMaterial,
  PointLight,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { runtime, useGame } from "../state/store";
import { isInsideOpenPortal } from "./portalEntry";
import type { PortalAnchor } from "./portalEntry";
import { treePortalPresence } from "./treePortalAnimation";
import { treePortalEntryAnchor, fitTreePortalGeometry, fitTreePortalTube, TREE_PORTAL_CENTER_Y, TREE_PORTAL_RADIUS_X, TREE_PORTAL_RADIUS_Y, type TreePortalFit } from "./treePortalFit";

// Matches assets_referencia/portal_arvore/portal_arvore_referencia.jpg: an
// oval opening among the roots, wrapped in a woven ring of vines, with a
// swirling cyan vortex inside rather than a flat dark capsule.
const FRAME_RADIUS_X = TREE_PORTAL_RADIUS_X;
const FRAME_RADIUS_Y = TREE_PORTAL_RADIUS_Y;
const STRAND_COUNT = 9;
const STRAND_TUBE_RADIUS = 0.055;
const STRAND_TONES = ["#475647", "#69735b", "#3e4b3d", "#817b5b"];
const OPEN_LERP_SPEED = 4.5;
// The fitted bark profile supplies clearance; keep the plasma behind the woven vines.
const SWIRL_DEPTH_OFFSET = 0.08;

function random(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// One woven strand of the ring, following an oval path — same braided-rope
// idea as SelectionVine's wreath (twist offset + organic wobble), shaped
// tall rather than flat and given a little depth wobble so the frame reads
// as a round woven ring instead of a flat outline.
function frameStrandCurve(seed: number, phase: number) {
  const rng = random(seed);
  const segments = 72;
  const points: Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const braid = t * (3 + seed % 3) + phase;
    const wobble = 1 + Math.sin(t * 3 + seed) * 0.05 + (rng() - 0.5) * 0.03;
    points.push(
      new Vector3(
        Math.sin(t) * (FRAME_RADIUS_X * wobble + Math.cos(braid) * 0.12),
        Math.cos(t) * (FRAME_RADIUS_Y * wobble + Math.sin(braid * 0.9) * 0.12),
        0.12 + Math.sin(braid) * 0.11,
      ),
    );
  }
  return new CatmullRomCurve3(points, true, "centripetal");
}

const NOISE = `
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
    mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
    mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p) { float n=0.0; float a=0.5; for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.07+vec3(7.1);a*=0.5;}return n; }
`;
const SWIRL_VERTEX = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const SWIRL_FRAGMENT = `uniform float uTime; uniform float uPresence; varying vec2 vUv;${NOISE}
void main(){
  vec2 uv=(vUv-0.5)*2.0;
  float r=length(uv);
  if (r>1.0) discard;
  float angle=atan(uv.y,uv.x);
  float spin=angle + 2.8*(1.0-r) - uTime*0.65;
  vec2 p=vec2(cos(spin),sin(spin))*r;
  vec2 warp=vec2(fbm(vec3(p*3.0,uTime*0.22)),fbm(vec3(p*3.0+8.0,-uTime*0.18)));
  float field=fbm(vec3(p*3.0+warp*1.3,uTime*0.3));
  float veins=pow(1.0-abs(sin(field*18.0-r*3.0+uTime*0.35)),9.0);
  float filaments=pow(1.0-abs(sin(field*27.0+angle*0.6-uTime*0.4)),16.0);
  vec3 color=mix(vec3(0.0,0.035,0.09),vec3(0.0,0.58,0.72),smoothstep(0.22,0.72,field));
  color += veins*vec3(0.2,0.95,1.1)+filaments*vec3(0.3,0.65,0.7);
  color += pow(r,8.0)*vec3(0.04,0.75,0.85);
  float dissolve=smoothstep(1.0-uPresence-0.12,1.0-uPresence+0.12,field);
  gl_FragColor=vec4(color,smoothstep(1.0,0.94,r)*dissolve*uPresence);
  #include <colorspace_fragment>
}`;

function rootGeometry(index: number) {
  const side = index % 2 ? 1 : -1;
  const reach = 1.2 + (index % 4) * 0.32;
  const curve = new CatmullRomCurve3([
    new Vector3(side * 0.88, 0.9 + (index % 3) * 0.22, -0.16),
    new Vector3(side * 0.8, 0.24, 0.1),
    new Vector3(side * reach, 0.08, 0.4 + (index % 3) * 0.4),
    new Vector3(side * (reach + 0.6), 0.015, 0.65 + (index % 3) * 0.6),
  ]);
  const geometry = new TubeGeometry(curve, 36, 0.17, 8, false);
  const positions = geometry.getAttribute("position");
  for (let ring = 0; ring <= 36; ring++) {
    const center = curve.getPointAt(ring / 36);
    const taper = Math.pow(1 - ring / 36, 0.85) + 0.025;
    for (let j = 0; j <= 8; j++) {
      const i = ring * 9 + j;
      positions.setXYZ(i, center.x + (positions.getX(i)-center.x)*taper,
        center.y + (positions.getY(i)-center.y)*taper,
        center.z + (positions.getZ(i)-center.z)*taper);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A woven, vine-framed opening in a tree's own roots, used for map transitions. */
export default function TreeEntrance({
  anchor,
  open,
  running,
  closing = false,
  onEnter,
  lifetime,
  surfaceFit,
}: {
  anchor: PortalAnchor;
  open: boolean;
  running: boolean;
  closing?: boolean;
  onEnter: () => void;
  lifetime?: number;
  surfaceFit?: TreePortalFit;
}) {
  const wasInside = useRef(false);
  const frame = useRef<Group>(null);
  const swirl = useRef<ShaderMaterial>(null);
  const roots = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const elapsed = useRef(0);
  const rootGeometries = useMemo(() => Array.from({ length: 8 }, (_, i) => fitTreePortalTube(rootGeometry(i), surfaceFit, 0, 8, true)), [surfaceFit]);
  const plasmaGeometry = useMemo(() => {
    const geometry = new PlaneGeometry(FRAME_RADIUS_X * 1.88, FRAME_RADIUS_Y * 1.88, 16, 80);
    geometry.translate(0, 0, SWIRL_DEPTH_OFFSET);
    return fitTreePortalGeometry(geometry, surfaceFit, TREE_PORTAL_CENTER_Y);
  }, [surfaceFit]);
  const materials = useMemo(() => STRAND_TONES.map(color => new MeshStandardMaterial({ color, roughness: 0.96, transparent: true })), []);
  const progress = useRef(open && !closing ? 1 : 0);

  const strandGeometries = useMemo(
    () =>
      Array.from(
        { length: STRAND_COUNT },
        (_, i) =>
          fitTreePortalTube(new TubeGeometry(
            frameStrandCurve(i * 13 + 7, (i / STRAND_COUNT) * Math.PI * 2),
            140,
            STRAND_TUBE_RADIUS,
            6,
            true,
          ), surfaceFit, TREE_PORTAL_CENTER_Y, 6),
      ),
    [surfaceFit],
  );
  useEffect(
    () => () => {
      [plasmaGeometry, ...strandGeometries, ...rootGeometries].forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
    },
    [plasmaGeometry, strandGeometries, rootGeometries, materials],
  );
  const swirlUniforms = useMemo(() => ({ uTime: { value: 0 }, uPresence: { value: 1 } }), []);

  useFrame((_, delta) => {
    if (!running) return;
    elapsed.current += delta;
    const target = open && !closing ? 1 : 0;
    progress.current += (target - progress.current) * Math.min(1, delta * OPEN_LERP_SPEED);
    const presence = progress.current * (lifetime === undefined ? 1 : treePortalPresence(elapsed.current, lifetime));
    if (frame.current) {
      frame.current.visible = presence > 0.001;
      frame.current.scale.set(surfaceFit ? 1 : 0.45 + presence * 0.55, surfaceFit ? 1 : 0.75 + presence * 0.25, 1);
      frame.current.position.y = TREE_PORTAL_CENTER_Y - (surfaceFit ? 0 : (1 - presence) * 0.4);
    }
    if (roots.current) {
      roots.current.visible = presence > 0.001;
      roots.current.scale.setScalar(surfaceFit ? 1 : 0.4 + presence * 0.6);
      roots.current.position.y = surfaceFit ? 0 : -(1 - presence) * 0.4;
    }
    materials.forEach(material => { material.opacity = presence; material.depthWrite = presence > 0.95; });
    if (light.current) light.current.intensity = presence * 3.5;
    if (swirl.current) {
      swirl.current.uniforms.uTime.value = elapsed.current;
      swirl.current.uniforms.uPresence.value = presence;
    }
    const selected = useGame.getState().puzzle.selected;
    const inside = isInsideOpenPortal(runtime.positions[selected],
      lifetime === undefined && open && !closing && presence > 0.95,
      treePortalEntryAnchor(anchor, surfaceFit, runtime.positions[selected].y));
    if (inside && !wasInside.current) onEnter();
    wasInside.current = inside;
  });

  return (
    <group
      name="tree-entrance"
      position={[anchor.x, anchor.y ?? 0, anchor.z]}
      // Single pivot for the whole assembly (ring + swirl + collider), centered
      // on the anchor's own position — set anchor.rotationY at the call site to
      // turn the whole portal in place.
      rotation={[0, anchor.rotationY ?? 0, 0]}
    >
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[anchor.halfWidth, 1.8, anchor.halfDepth]} sensor />
      </RigidBody>
      <group ref={frame} visible={false} position={[0, TREE_PORTAL_CENTER_Y, 0]}>
        <mesh name="tree-portal-plasma" geometry={plasmaGeometry}>
          <shaderMaterial
            ref={swirl}
            uniforms={swirlUniforms}
            vertexShader={SWIRL_VERTEX}
            fragmentShader={SWIRL_FRAGMENT}
            side={DoubleSide}
            transparent
            depthWrite={false}
          />
        </mesh>
        {strandGeometries.map((geometry, i) => (
          <mesh key={i} geometry={geometry} material={materials[i % materials.length]} castShadow />
        ))}
      </group>
      <group ref={roots}>
        {rootGeometries.map((geometry, i) => <mesh key={i} geometry={geometry} material={materials[i % materials.length]} castShadow receiveShadow />)}
      </group>
      <pointLight ref={light} position={[0, TREE_PORTAL_CENTER_Y, 0.6]} color="#09eaff" intensity={0} distance={6} decay={2} />
    </group>
  );
}
