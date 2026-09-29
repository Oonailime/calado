"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import styles from "./VineScrollbar.module.css";

// The page's scrollbar as a tree trunk: a vine hangs from the top of the
// trunk down to the thumb, which is a coil of vine wrapped around it. Drag
// the coil, or press the trunk, to scroll. Pointer only; the native keys
// and wheel still scroll the page (the native bar is hidden in CSS).
const WIDTH = 30;
const CENTER = WIDTH / 2;
const MIN_THUMB = 60;
const VINE_PERIOD = 34;
const LEAF = "M0 0C2.8-3.6 7.6-3.8 11 0C7.6 3.8 2.8 3.6 0 0Z";

function wavePath(height: number, amplitude: number, phase: number) {
  let d = "";
  for (let y = 0; y <= height; y += 2)
    d += `${y ? "L" : "M"}${(CENTER + Math.sin((y / VINE_PERIOD) * Math.PI * 2 + phase) * amplitude).toFixed(1)} ${y}`;
  return d;
}

function Leaf({ x, y, angle, scale, color }: { x: number; y: number; angle: number; scale: number; color: string }) {
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle}) scale(${scale})`}>
      <path className={styles.leaf} d={LEAF} fill={color} />
    </g>
  );
}

function scrollMetrics() {
  const max = document.documentElement.scrollHeight - innerHeight;
  return { max, progress: max > 0 ? scrollY / max : 0 };
}

export default function VineScrollbar({ reduced }: { reduced: boolean }) {
  const barkId = useId();
  const shadeId = useId();
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const hanging = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; scroll: number } | null>(null);
  const [size, setSize] = useState({ track: 0, thumb: MIN_THUMB });
  const sizeRef = useRef(size);

  useEffect(() => {
    let frame = 0;
    const place = () => {
      frame = 0;
      const { track: trackHeight, thumb: thumbHeight } = sizeRef.current;
      const top = scrollMetrics().progress * Math.max(0, trackHeight - thumbHeight);
      if (thumb.current) thumb.current.style.transform = `translateY(${top}px)`;
      if (hanging.current) hanging.current.style.height = `${top + thumbHeight / 2}px`;
    };
    const measure = () => {
      const trackHeight = track.current?.clientHeight ?? 0;
      const ratio = innerHeight / document.documentElement.scrollHeight;
      const next = { track: trackHeight, thumb: Math.min(trackHeight, Math.max(MIN_THUMB, trackHeight * ratio)) };
      sizeRef.current = next;
      setSize((previous) => (previous.track === next.track && previous.thumb === next.thumb ? previous : next));
      place();
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    measure();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", measure);
    };
  }, []);

  const travel = Math.max(1, size.track - size.thumb);
  const onThumbDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, scroll: scrollY };
  };
  const onThumbMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    scrollTo({ top: drag.current.scroll + ((event.clientY - drag.current.y) * scrollMetrics().max) / travel, behavior: "instant" });
  };
  const onThumbUp = () => {
    drag.current = null;
  };
  const onTrackDown = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const target = Math.min(1, Math.max(0, (event.clientY - bounds.top - size.thumb / 2) / travel));
    scrollTo({ top: target * scrollMetrics().max, behavior: reduced ? "instant" : "smooth" });
  };

  const coils = Array.from({ length: Math.max(3, Math.floor((size.thumb - 8) / 7)) }, (_, i) => 6 + i * 7);
  const hangingLeaves = Array.from({ length: Math.floor(size.track / 52) }, (_, i) => 26 + i * 52);
  return (
    <div ref={track} className={styles.scrollbar} onPointerDown={onTrackDown} aria-hidden="true">
      <svg className={styles.trunk} width={WIDTH} height="100%">
        <defs>
          <pattern id={barkId} className={styles.furrows} width={WIDTH} height={97} patternUnits="userSpaceOnUse">
            <path d="M10.5 0C9.6 20 11.4 44 10.3 66S10.9 97 10.5 97" />
            <path d="M15.2 0C16.4 26 14 50 15.6 74S15 97 15.2 97" />
            <path d="M19.6 0C18.8 18 20.5 40 19.4 60S20 97 19.6 97" />
            <ellipse cx={17.4} cy={38} rx={1.5} ry={2.6} />
          </pattern>
          <linearGradient id={shadeId}>
            <stop offset="0" className={styles.shadeEdge} />
            <stop offset="0.4" className={styles.shadeLight} />
            <stop offset="0.58" className={styles.shadeLight} />
            <stop offset="1" className={styles.shadeEdge} />
          </linearGradient>
        </defs>
        <rect className={styles.bark} x={8} width={14} height="100%" rx={7} />
        <rect x={8} width={14} height="100%" rx={7} fill={`url(#${barkId})`} />
        <rect x={8} width={14} height="100%" rx={7} fill={`url(#${shadeId})`} />
      </svg>
      <div className={styles.crown}>
        <svg width={WIDTH} height={22} viewBox={`0 0 ${WIDTH} 22`}>
          <Leaf x={CENTER} y={10} angle={-150} scale={1} color="#387141" />
          <Leaf x={CENTER} y={9} angle={-35} scale={1.05} color="#4d863c" />
          <Leaf x={CENTER} y={8} angle={-95} scale={0.9} color="#6e9a3c" />
        </svg>
      </div>
      <div ref={hanging} className={styles.hanging}>
        <svg width={WIDTH} height={size.track}>
          <path className={styles.vineStrand} d={wavePath(size.track, 6.5, 0)} />
          <path className={styles.vineTendril} d={wavePath(size.track, 8, 1.9)} />
          {hangingLeaves.map((y, i) => (
            <Leaf key={y} x={CENTER + (i % 2 ? 5 : -5)} y={y} angle={i % 2 ? 30 : 150} scale={0.62}
              color={["#387141", "#4d863c", "#6e9a3c"][i % 3]} />
          ))}
        </svg>
      </div>
      <div
        ref={thumb}
        className={styles.thumb}
        style={{ height: size.thumb }}
        onPointerDown={onThumbDown}
        onPointerMove={onThumbMove}
        onPointerUp={onThumbUp}
        onPointerCancel={onThumbUp}
      >
        <svg width={WIDTH} height={size.thumb}>
          {coils.map((y, i) => (
            <g key={y}>
              <path className={styles[`coil${i % 3}`]} d={`M6.5 ${y + 3}C11 ${y + 5.5} 19 ${y + 1.5} 23.5 ${y - 2}`} />
              <path className={styles.coilLight} d={`M8 ${y + 3.2}C12 ${y + 5} 18.5 ${y + 1.6} 22 ${y - 1}`} />
            </g>
          ))}
          <Leaf x={6} y={6} angle={-160} scale={0.8} color="#4d863c" />
          <Leaf x={24} y={size.thumb * 0.5} angle={-15} scale={0.85} color="#387141" />
          <Leaf x={6} y={size.thumb - 6} angle={165} scale={0.8} color="#6e9a3c" />
        </svg>
      </div>
    </div>
  );
}
