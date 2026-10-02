export function touchHint(body: string, pt: boolean, abilityKey: string) {
  const ability = abilityKey.replace("Key", "");
  let text = body;
  if (pt) {
    text = text.replace(/Clique na tela para olhar ao redor com o mouse; pressione Esc quando quiser liberar o cursor\./g, "Arraste à direita para girar a câmera e pince para o zoom.");
    text = text.replace(/Use WASD ou as setas/g, "Use o joystick");
    text = text.replace(/WASD/g, "Joystick").replace(/Shift\/Alt/g, "Subir/Descer");
    text = text.replace(/1\/2\/3: trocar macaco/g, "Retratos: trocar macaco");
    text = text.replace(/E ou Enter|E, Enter ou|E, Enter|Enter ou E/g, "Interagir");
    text = text.replace(/pressione [123]/gi, "toque no retrato do macaco");
    text = text.replace(/pressione Espaço/gi, "toque em Pular").replace(/Espaço/g, "Pular");
    text = text.replace(/pressione E/gi, "toque em Interagir").replace(/\bE\b/g, "Interagir");
    text = text.replace(new RegExp(`pressione ${ability}\\b`, "gi"), "toque em Habilidade");
    text = text.replace(new RegExp(`\\b${ability}\\b`, "g"), "Habilidade");
  } else {
    text = text.replace(/Click the screen to look around with the mouse; press Esc whenever you want to release the cursor\./g, "Drag on the right to turn the camera and pinch to zoom.");
    text = text.replace(/Use WASD or the arrow keys/g, "Use the joystick");
    text = text.replace(/WASD/g, "Joystick").replace(/Shift\/Alt/g, "Climb/Descend");
    text = text.replace(/1\/2\/3: switch monkey/g, "Portraits: switch monkey");
    text = text.replace(/E or Enter|E, Enter, or|E, Enter/g, "Interact");
    text = text.replace(/press [123]/gi, "tap the monkey portrait");
    text = text.replace(/press Space/gi, "tap Jump").replace(/Space/g, "Jump");
    text = text.replace(/press E/gi, "tap Interact").replace(/\bE\b/g, "Interact");
    text = text.replace(new RegExp(`press ${ability}\\b`, "gi"), "tap Ability");
    text = text.replace(new RegExp(`\\b${ability}\\b`, "g"), "Ability");
  }
  return text;
}
