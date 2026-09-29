import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AdditiveBlending, BufferGeometry, DoubleSide, Mesh, PointLight, ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import {
  createPhaseTwoChess, PHASE_TWO_CHESS_PIECE_KINDS, PHASE_TWO_CHESS_PIECE_URL,
  type ChessPieceKind,
} from "@/features/game/world/phaseTwoAssets";
import { PHASE_TWO_TABLE, PHASE_TWO_VOLCANOES, phaseTwoGroundHeight } from "@/features/game/world/phaseTwoLayout";
import {
  VOLCANIC_CHESS_ROTATION,
  VOLCANIC_CHESS_SCALE,
  VOLCANIC_ROUTE,
  VOLCANIC_STORY_SCALE,
} from "./volcanicStoryRoute";
import { createVolcanicStoryAssets, STORY_CHERRY, STORY_CHERRY_SCALE, STORY_CHESS, STORY_HEARTH, valleyToStory, volcanicStoryGround } from "./volcanicStoryAssets";
import { basaltShader, FIRE_FRAGMENT, LAVA_FRAGMENT, LAVA_VERTEX } from "./volcanicStoryShaders";
import VolcanicWeather from "./VolcanicWeather";

function StoryChess() {
  const models = useLoader(GLTFLoader, PHASE_TWO_CHESS_PIECE_KINDS.map(PHASE_TWO_CHESS_PIECE_URL));
  const geometry = useMemo(() => {
    const pieces = Object.fromEntries(models.map((model, index) => {
      let geometry: BufferGeometry | undefined;
      model.scene.traverse(child => { if (!geometry && child instanceof Mesh) geometry = child.geometry; });
      return [PHASE_TWO_CHESS_PIECE_KINDS[index], geometry!];
    })) as Record<ChessPieceKind, BufferGeometry>;
    const g = createPhaseTwoChess(pieces);
    g.translate(-PHASE_TWO_TABLE[0], -phaseTwoGroundHeight(...PHASE_TWO_TABLE), -PHASE_TWO_TABLE[1]);
    // The game's own set, at the monkeys' scale so two of them sit at it.
    g.scale(VOLCANIC_CHESS_SCALE, VOLCANIC_CHESS_SCALE, VOLCANIC_CHESS_SCALE);
    return g;
  }, [models]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="story-chess-table" geometry={geometry} position={[STORY_CHESS.x, -0.02, STORY_CHESS.z]} rotation={[0, VOLCANIC_CHESS_ROTATION, 0]} castShadow receiveShadow>
    <meshStandardMaterial vertexColors roughness={0.8} />
  </mesh>;
}

export default function VolcanicScenery({ active, reduced, progress, chessLoaded }: {
  active: boolean; reduced: boolean; progress: number;
  // Rendered beside the chess set, inside its Suspense boundary.
  chessLoaded?: ReactNode;
}) {
  const assets = useMemo(() => createVolcanicStoryAssets(), []);
  const lava = useRef<ShaderMaterial>(null);
  const flame = useRef<ShaderMaterial>(null);
  const light = useRef<PointLight>(null);
  const elapsed = useRef(0);
  const lavaUniforms = useMemo(() => UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 } }]), []);
  const fireUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useEffect(() => () => Object.values(assets).forEach(g => g.dispose()), [assets]);
  useFrame((_, delta) => {
    if (!active || reduced) return;
    elapsed.current += Math.min(delta, 0.05);
    if (lava.current) lava.current.uniforms.uTime.value = elapsed.current;
    if (flame.current) flame.current.uniforms.uTime.value = elapsed.current;
    if (light.current) light.current.intensity = 20 + Math.sin(elapsed.current * 8) * 1.1 + Math.sin(elapsed.current * 13) * 0.7;
  });
  const chapter = Math.min(5, Math.floor(progress * 8));
  return <group name="volcanic-story-design">
    <VolcanicWeather active={active} reduced={reduced} petalSources={assets.petalSources} />
    {(["terrain", "rocks", "dead", "foreground", "path"] as const).map(key => (
      <mesh key={key} name={`story-volcanic-${key}`} geometry={assets[key]} castShadow={key === "foreground"} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.98} onBeforeCompile={basaltShader} />
      </mesh>
    ))}
    <mesh name="story-lava-rivers" geometry={assets.lava}>
      <shaderMaterial ref={lava} uniforms={lavaUniforms} vertexShader={LAVA_VERTEX} fragmentShader={LAVA_FRAGMENT} side={DoubleSide} fog />
    </mesh>
    {PHASE_TWO_VOLCANOES.map(v => {
      const crater = valleyToStory(v.x, v.z);
      return <mesh key={v.seed}
        position={[crater.x, volcanicStoryGround(crater.x, crater.z) + 0.06, crater.z]}
        rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[v.radius * 0.07, 24]} />
        <meshBasicMaterial color="#ff6f27" toneMapped={false} />
      </mesh>;
    })}
    <group position={[STORY_CHERRY.x, -0.035, STORY_CHERRY.z]} scale={STORY_CHERRY_SCALE} name="story-cherry">
      <mesh geometry={assets.bark} castShadow receiveShadow>
        <meshStandardMaterial color="#8e7f78" vertexColors roughness={0.94} onBeforeCompile={basaltShader} />
      </mesh>
      <mesh geometry={assets.blossoms} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.82} side={DoubleSide} emissive="#a24b65" emissiveIntensity={0.065} />
      </mesh>
    </group>
    <pointLight position={[STORY_CHERRY.x - 1, 6, STORY_CHERRY.z + 2]} color="#ffd9df" intensity={25} distance={17} decay={2} />
    <group position={[STORY_HEARTH.x, 0, STORY_HEARTH.z]} name="three-monkeys-hearth">
      <mesh geometry={assets.hearth} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} onBeforeCompile={basaltShader} />
      </mesh>
      <mesh position={[0, 0.74, 0]}>
        <planeGeometry args={[1.25, 1.5]} />
        <shaderMaterial ref={flame} uniforms={fireUniforms} vertexShader={LAVA_VERTEX} fragmentShader={FIRE_FRAGMENT} transparent side={DoubleSide} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <pointLight ref={light} position={[0, 0.85, 0]} color="#ff9c50" intensity={20} distance={12} decay={2} />
    </group>
    <Suspense fallback={null}><StoryChess />{chessLoaded}</Suspense>
    {/* One lamp beside each (larger) house, sized with it. */}
    {VOLCANIC_ROUTE.points.map((point, index) => <group key={index}
      position={[point.x + 2.25 * VOLCANIC_STORY_SCALE, 0, point.z + 0.6 * VOLCANIC_STORY_SCALE]}
      scale={0.65 * VOLCANIC_STORY_SCALE}>
      <mesh geometry={assets.lantern} castShadow>
        <meshStandardMaterial vertexColors roughness={0.55} metalness={0.45} />
      </mesh>
      <mesh position={[0, 0.72, 0]} scale={[0.085, 0.22, 0.085]}>
        <sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color="#ffe6ae" toneMapped={false} />
      </mesh>
      {chapter === index && <pointLight position={[0, 0.9, 0]} color="#ffb76e" intensity={14} distance={9} decay={2} />}
    </group>)}
    {/* The chess table's lamp, off to its right rather than against it. */}
    <group name="story-chess-lamp" position={[STORY_CHESS.x + 4.2, 0, STORY_CHESS.z + 0.8]} scale={0.65 * VOLCANIC_STORY_SCALE}>
      <mesh geometry={assets.lantern}><meshStandardMaterial vertexColors roughness={0.5} metalness={0.4} /></mesh>
      <mesh position={[0, 0.72, 0]} scale={[0.085, 0.24, 0.085]}><sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color="#ffe6ae" toneMapped={false} /></mesh>
      <pointLight position={[0, 1, 0]} color="#ffc47c" intensity={12} distance={8} decay={2} />
    </group>
  </group>;
}
