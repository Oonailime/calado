import { CanvasTexture, LinearFilter } from "three";

// Module-level cache keyed by text, built with a plain function (not a hook)
// — the same pattern this codebase already uses for the monkey rig cache, so
// it works fine even though it's called from inside a render body.
const cache = new Map<string, CanvasTexture>();

export function labelTexture(text: string): CanvasTexture {
  const cached = cache.get(text);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const r = 14;
    ctx.beginPath();
    ctx.moveTo(r, 4);
    ctx.arcTo(w - 4, 4, w - 4, h - 4, r);
    ctx.arcTo(w - 4, h - 4, 4, h - 4, r);
    ctx.arcTo(4, h - 4, 4, 4, r);
    ctx.arcTo(4, 4, w - 4, 4, r);
    ctx.closePath();
    ctx.fillStyle = "#e9dcb8";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#8a6f45";
    ctx.stroke();
    ctx.fillStyle = "#4a3a22";
    ctx.font = "600 40px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  cache.set(text, texture);
  return texture;
}
