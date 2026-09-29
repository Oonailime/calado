import type { CSSProperties } from "react";
import type { Locale } from "@/content/story";
import { MonkeyGlyph } from "./SceneArt";
import styles from "./VineLoader.module.css";

// The in-game selection wreath (SelectionVine.tsx) as a loading mark: a
// braided bark ring, a green tendril growing around it and leaves swaying in
// a wave, with the monkey inside it as in the game.
//
// It plays while the story scene loads, parses models and compiles shaders,
// all of which block the main thread. Every moving part is therefore an HTML
// box animating only transform or opacity, which the browser runs on the
// compositor thread; SVG-internal animations (a <g> transform, a dash offset)
// run on the main thread and would freeze with it.
const RADIUS = 38;
const BARK = [
  { base: "#5c4327", light: "#9a7448" },
  { base: "#6b4f2c", light: "#a9834f" },
  { base: "#4a3620", light: "#86653d" },
];
const LEAF_COLORS = ["#24553a", "#387141", "#4d863c", "#6e9a3c", "#8aaa42"];
const LEAF_COUNT = 12;
const WAVE_SECONDS = 2.6;
const RING_STEPS = 180;
/** The tendril appears piece by piece; 60 pieces of 6 degrees read as a line. */
const TENDRIL_PIECES = 60;
/** Share of each wave the tendril takes to close the ring, before it withers. */
const TENDRIL_GROW = 0.6;

type Point = readonly [number, number];

function ringPoints(radius: (angle: number) => number): Point[] {
  return Array.from({ length: RING_STEPS + 1 }, (_, i) => {
    const angle = (i / RING_STEPS) * Math.PI * 2;
    const r = radius(angle);
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  });
}

function linePath(points: readonly Point[]) {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
}

function random(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** When CSS ease-in-out reaches `progress`, as a share of its duration. */
function easeInOutTime(progress: number) {
  const bezier = (t: number, p1: number, p2: number) =>
    3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3;
  let low = 0,
    high = 1;
  for (let i = 0; i < 24; i++) {
    const t = (low + high) / 2;
    if (bezier(t, 0, 1) < progress) low = t;
    else high = t;
  }
  return bezier((low + high) / 2, 0.42, 0.58);
}

const STRANDS = BARK.map((tone, i) => ({
  ...tone,
  d: `${linePath(ringPoints((a) => RADIUS + 2.4 * Math.cos(a * 9 + i * 2.09) + 0.6 * Math.sin(a * 3 + i)))}Z`,
}));

// Each piece of the tendril fades in while an ease-in-out sweep would cross
// it, so together they grow around the ring like the stroke they replace.
// A piece is its own small box (the wreath spans 100 units = 100%) so the
// compositor keeps small layers instead of 60 full-size ones.
const TENDRIL_POINTS = ringPoints((a) => RADIUS + 4 * Math.sin(a * 13 + 0.8));
const TENDRIL_DISTANCE = TENDRIL_POINTS.reduce<number[]>(
  (sum, [x, y], i) => {
    if (i) sum.push(sum[i - 1] + Math.hypot(x - TENDRIL_POINTS[i - 1][0], y - TENDRIL_POINTS[i - 1][1]));
    return sum;
  },
  [0],
);
const TENDRIL = Array.from({ length: TENDRIL_PIECES }, (_, k) => {
  const first = (k * RING_STEPS) / TENDRIL_PIECES,
    last = ((k + 1) * RING_STEPS) / TENDRIL_PIECES;
  const points = TENDRIL_POINTS.slice(first, last + 1);
  const pad = 0.8;
  const minX = Math.min(...points.map((p) => p[0])) - pad,
    minY = Math.min(...points.map((p) => p[1])) - pad;
  const width = Math.max(...points.map((p) => p[0])) + pad - minX,
    height = Math.max(...points.map((p) => p[1])) + pad - minY;
  const at = (step: number) =>
    (TENDRIL_GROW * 100 * easeInOutTime(TENDRIL_DISTANCE[step] / TENDRIL_DISTANCE[RING_STEPS])).toFixed(2);
  return {
    d: linePath(points),
    viewBox: `${minX.toFixed(2)} ${minY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`,
    style: {
      left: `${(minX + 50).toFixed(2)}%`,
      top: `${(minY + 50).toFixed(2)}%`,
      width: `${width.toFixed(2)}%`,
      height: `${height.toFixed(2)}%`,
      "--grow": `vineLoaderTendril${k}`,
    } as CSSProperties,
    keyframes: `@keyframes vineLoaderTendril${k}{0%,${at(first)}%{opacity:0}${at(last)}%,100%{opacity:1}}`,
  };
});
const TENDRIL_KEYFRAMES = TENDRIL.map((piece) => piece.keyframes).join("");

const rng = random(11);
const LEAVES = Array.from({ length: LEAF_COUNT }, (_, i) => {
  const angle = (i / LEAF_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.25;
  const outward = i % 2 === 0;
  const r = RADIUS + (outward ? 2.5 : -2.5);
  const degrees = (angle * 180) / Math.PI;
  return {
    // The leaf box is 11 x 6 units with its stem at the middle of the left
    // edge, which is where it is placed and what it turns and sways about.
    style: {
      left: `${(50 + Math.cos(angle) * r).toFixed(2)}%`,
      top: `${(47 + Math.sin(angle) * r).toFixed(2)}%`,
      transform: `rotate(${(outward ? degrees - 40 : degrees + 220).toFixed(1)}deg) scale(${(0.85 + rng() * 0.35).toFixed(2)})`,
    },
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
      <style>{TENDRIL_KEYFRAMES}</style>
      <div className={styles.mark} style={{ "--wave": `${WAVE_SECONDS}s` } as CSSProperties}>
        <div className={styles.wreath} aria-hidden="true">
          <svg className={styles.bark} viewBox="-50 -50 100 100">
            {STRANDS.map((strand) => (
              <g key={strand.d}>
                <path d={strand.d} stroke={strand.base} strokeWidth={3.4} />
                <path d={strand.d} stroke={strand.light} strokeWidth={0.9} opacity={0.55} />
              </g>
            ))}
          </svg>
          <div className={styles.tendril}>
            {TENDRIL.map((piece) => (
              <span key={piece.d} className={styles.piece} style={piece.style}>
                <svg viewBox={piece.viewBox}>
                  <path d={piece.d} />
                </svg>
              </span>
            ))}
          </div>
          {LEAVES.map((leaf) => (
            <span key={leaf.delay} className={styles.leafSlot} style={leaf.style}>
              <span className={styles.leaf} style={{ animationDelay: leaf.delay }}>
                <svg viewBox="0 -3 11 6">
                  <path d="M0 0C2.8-3.6 7.6-3.8 11 0C7.6 3.8 2.8 3.6 0 0Z" fill={leaf.color} />
                  <path d="M0.8 0L9.4 0" stroke="#1d3a26" strokeWidth={0.45} opacity={0.6} />
                </svg>
              </span>
            </span>
          ))}
        </div>
        <svg className={styles.monkey} viewBox="-60 -80 150 180" aria-hidden="true">
          <MonkeyGlyph color="#b7a17b" />
        </svg>
      </div>
      <p className={styles.brand}>EMILIANO CALADO</p>
      <p className={styles.label}>{visible ? (pt ? "Preparando a jornada…" : "Preparing the journey…") : ""}</p>
    </div>
  );
}
