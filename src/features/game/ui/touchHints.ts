export function touchHint(body: string, pt: boolean, abilityKey: string) {
  const ability = abilityKey.replace("Key", "");
  let text = body;
  if (pt) {
    text = text.replace(/Clique na tela para olhar ao redor com o mouse; pressione Esc quando quiser liberar o cursor\./g, "Arraste à direita para girar a câmera e pince para o zoom.");
    text = text.replace(/Use WASD ou as setas/g, "Use o joystick");
    text = text.replace(/WASD/g, "Joystick").replace(/Shift\/Alt/g, "Subir/Descer");
    text = text.replace(/1\/2\/3: trocar macaco/g, "Retratos: trocar macaco");
    // Enter is the keyboard twin of E; on touch both are the one Interact button.
    text = text.replace(new RegExp(`E, Enter ou ${ability}\\b`, "g"), `E ou ${ability}`);
    text = text.replace(/E ou Enter|E, Enter|Enter ou E/g, "E");
    text = text.replace(/pressione [123]\b/gi, "toque no retrato do macaco");
    text = text.replace(new RegExp(`pressione (?=(Espaço|E|${ability})\\b)`, "gi"), "toque em ");
    text = text.replace(/Espaço/g, "Pular").replace(/\bE\b/g, "Interagir");
    text = text.replace(new RegExp(`\\b${ability}\\b`, "g"), "Habilidade");
  } else {
    text = text.replace(/Click the screen to look around with the mouse; press Esc whenever you want to release the cursor\./g, "Drag on the right to turn the camera and pinch to zoom.");
    text = text.replace(/Use WASD or the arrow keys/g, "Use the joystick");
    text = text.replace(/WASD/g, "Joystick").replace(/Shift\/Alt/g, "Climb/Descend");
    text = text.replace(/1\/2\/3: switch monkey/g, "Portraits: switch monkey");
    text = text.replace(new RegExp(`E, Enter, or ${ability}\\b`, "g"), `E or ${ability}`);
    text = text.replace(/E or Enter|E, Enter/g, "E");
    text = text.replace(/press [123]\b/gi, "tap the monkey portrait");
    text = text.replace(new RegExp(`press (?=(Space|E|${ability})\\b)`, "gi"), "tap ");
    text = text.replace(/Space/g, "Jump").replace(/\bE\b/g, "Interact");
    text = text.replace(new RegExp(`\\b${ability}\\b`, "g"), "Ability");
  }
  // "Pressione 3 ..." became "toque no retrato ..."; restore each sentence's capital.
  return text.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (_, start: string, letter: string) => start + letter.toUpperCase());
}
