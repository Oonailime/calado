import type { Locale } from "@/content/story";
import { MonkeyGlyph } from "./SceneArt";
import styles from "./VineLoader.module.css";

// The in-game selection wreath (SelectionVine.tsx) as a loading mark: a
// braided bark ring, a green tendril growing around it and leaves swaying in
// a wave, with the monkey inside it as in the game.
const RADIUS = 38;
const BARK = [
  { base: "#5c4327", light: "#9a7448" },
  { base: "#6b4f2c", light: "#a9834f" },
  { base: "#4a3620", light: "#86653d" },
];
const LEAF_COLORS = ["#24553a", "#387141", "#4d863c", "#6e9a3c", "#8aaa42"];
const LEAF_COUNT = 12;
const WAVE_SECONDS = 2.6;

function ringPath(radius: (angle: number) => number, steps = 180) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const r = radius(angle);
    d += `${i ? "L" : "M"}${(Math.cos(angle) * r).toFixed(2)} ${(Math.sin(angle) * r).toFixed(2)}`;
  }
  return `${d}Z`;
}

function random(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const STRANDS = BARK.map((tone, i) => ({
  ...tone,
  d: ringPath((a) => RADIUS + 2.4 * Math.cos(a * 9 + i * 2.09) + 0.6 * Math.sin(a * 3 + i)),
}));
const TENDRIL = ringPath((a) => RADIUS + 4 * Math.sin(a * 13 + 0.8));
const rng = random(11);
const LEAVES = Array.from({ length: LEAF_COUNT }, (_, i) => {
  const angle = (i / LEAF_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.25;
  const outward = i % 2 === 0;
  const r = RADIUS + (outward ? 2.5 : -2.5);
  const degrees = (angle * 180) / Math.PI;
  return {
    transform: `translate(${(Math.cos(angle) * r).toFixed(2)} ${(Math.sin(angle) * r).toFixed(2)}) rotate(${(outward ? degrees - 40 : degrees + 220).toFixed(1)}) scale(${(0.85 + rng() * 0.35).toFixed(2)})`,
    color: LEAF_COLORS[i % LEAF_COLORS.length],
    delay: `${(-(i / LEAF_COUNT) * WAVE_SECONDS).toFixed(2)}s`,
  };
});

export default function VineLoader({ visible, locale }: { visible: boolean; locale: Locale }) {
  const pt = locale === "pt";
  return (
    <div
      className={`${styles.loader} ${visible ? "" : styles.hidden}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible || undefined}
    >
      <div className={styles.mark}>
        <svg className={styles.wreath} viewBox="-50 -50 100 100" aria-hidden="true">
          {STRANDS.map((strand) => (
            <g key={strand.d}>
              <path d={strand.d} stroke={strand.base} strokeWidth={3.4} />
              <path d={strand.d} stroke={strand.light} strokeWidth={0.9} opacity={0.55} />
            </g>
          ))}
          <path className={styles.tendril} d={TENDRIL} pathLength={100} />
          {LEAVES.map((leaf) => (
            <g key={leaf.delay} transform={leaf.transform}>
              <g className={styles.leaf} style={{ animationDelay: leaf.delay }}>
                <path d="M0 0C2.8-3.6 7.6-3.8 11 0C7.6 3.8 2.8 3.6 0 0Z" fill={leaf.color} />
                <path d="M0.8 0L9.4 0" stroke="#1d3a26" strokeWidth={0.45} opacity={0.6} />
              </g>
            </g>
          ))}
        </svg>
        <svg className={styles.monkey} viewBox="-60 -80 150 180" aria-hidden="true">
          <MonkeyGlyph color="#b7a17b" />
        </svg>
      </div>
      <p className={styles.brand}>EMILIANO CALADO</p>
      <p className={styles.label}>{visible ? (pt ? "Preparando a jornada…" : "Preparing the journey…") : ""}</p>
    </div>
  );
}
