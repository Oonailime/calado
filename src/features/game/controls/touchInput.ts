export const ZOOM_MIN = 0.55;
export const ZOOM_MAX = 1.9;

export const JOYSTICK_RADIUS = 52;

export function joystickKeys(dx: number, dy: number, radius = JOYSTICK_RADIUS) {
  const threshold = radius * 0.24;
  const keys: string[] = [];
  if (dy < -threshold) keys.push("KeyW");
  if (dy > threshold) keys.push("KeyS");
  if (dx < -threshold) keys.push("KeyA");
  if (dx > threshold) keys.push("KeyD");
  return keys;
}

export function pinchZoom(current: number, previousDistance: number, distance: number) {
  if (previousDistance <= 0 || distance <= 0) return current;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current * previousDistance / distance));
}

/** How far the touch camera button pulls the view back (a zoom multiplier). */
export const CAMERA_FAR_ZOOM = 1.6;

export function cameraIsFar(zoom: number) {
  return zoom >= CAMERA_FAR_ZOOM - 0.01;
}

/** The camera button pulls back to CAMERA_FAR_ZOOM; pressed again, it returns to `previous`. */
export function cameraButtonZoom(zoom: number, previous: number) {
  return cameraIsFar(zoom) ? previous : CAMERA_FAR_ZOOM;
}
