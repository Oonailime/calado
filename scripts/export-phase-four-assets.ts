import { mkdir, writeFile } from "node:fs/promises";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  createPhaseFourAssetLibrary,
  createPhaseFourEnvironment,
} from "../src/features/game/world/phaseFourAssets";

// GLTFExporter only needs this browser API to pack the binary buffers. The
// assets use vertex colours, so exporting requires neither DOM nor textures.
class ExportFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}
Object.defineProperty(globalThis, "FileReader", {
  value: ExportFileReader,
  configurable: true,
});

async function main() {
  const directory = "public/assets/models/phase4";
  await mkdir(directory, { recursive: true });
  const exporter = new GLTFExporter();
  const library = {
    ...createPhaseFourAssetLibrary(),
    "canopy-village": createPhaseFourEnvironment(),
  };
  const manifest: Record<string, { file: string; bytes: number }> = {};
  for (const [name, object] of Object.entries(library)) {
    const binary = await exporter.parseAsync(object, { binary: true });
    if (!(binary instanceof ArrayBuffer))
      throw new Error(`Expected GLB for ${name}`);
    const file = `${name}.glb`;
    await writeFile(`${directory}/${file}`, Buffer.from(binary));
    manifest[name] = { file, bytes: binary.byteLength };
    process.stdout.write(
      `${file}: ${(binary.byteLength / 1024).toFixed(0)} KB\n`,
    );
  }
  await writeFile(
    `${directory}/manifest.json`,
    `${JSON.stringify({ reference: "imagem_referencia_mapa.jpg", note: "Runtime water and hanging vines are animated in PhaseFour.tsx; GLB exports are static reusable assets.", assets: manifest }, null, 2)}\n`,
  );
}
void main();
