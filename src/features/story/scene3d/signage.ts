import { CanvasTexture, LinearFilter } from "three";

// Module-level cache keyed by text, built with a plain function (not a hook)
// — the same pattern this codebase already uses for the monkey rig cache, so
// it works fine even though it's called from inside a render body.
const cache = new Map<string, CanvasTexture>();

export function letteringTexture(text: string): CanvasTexture {
  const cached = cache.get(text);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#11100d";
    ctx.strokeStyle = "#e9dcb8";
    ctx.lineWidth = 10;
    ctx.lineJoin = "round";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = text.toUpperCase();
    const maxWidth = w - 56;
    let fontSize = 176;
    ctx.font = `900 ${fontSize}px Arial, sans-serif`;
    while (fontSize > 54 && ctx.measureText(label).width > maxWidth) {
      fontSize -= 4;
      ctx.font = `900 ${fontSize}px Arial, sans-serif`;
    }
    // Transparent everywhere except the lettering: this replaces the text on
    // each facade instead of creating another rectangular plaque.
    ctx.strokeText(label, w / 2, h / 2 + 5);
    ctx.fillText(label, w / 2, h / 2 + 5);
  }
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  cache.set(text, texture);
  return texture;
}
