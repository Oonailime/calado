import { SceneArt } from "./SceneArt";
export default function SequenceArt({
  progress,
  reduced = false,
}: {
  progress: number;
  reduced?: boolean;
}) {
  const scene = Math.min(7, Math.floor(progress * 8));
  const phase = Math.min(1, progress * 8 - scene);
  const fade = reduced ? 0 : Math.max(0, Math.min(1, (phase - 0.72) / 0.28));
  const blend = fade * fade * (3 - 2 * fade);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <SceneArt scene={scene} progress={phase} reduced={reduced} />
      </div>
      {scene < 7 && blend > 0 && (
        <div style={{ position: "absolute", inset: 0, opacity: blend }}>
          <SceneArt scene={scene + 1} progress={0} reduced={reduced} />
        </div>
      )}
    </div>
  );
}
