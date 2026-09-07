export function powerAnchorVisibility(progress: {
  bridge: boolean;
  built: boolean;
}) {
  return {
    bridge: !progress.bridge,
    final: progress.bridge && !progress.built,
  };
}
