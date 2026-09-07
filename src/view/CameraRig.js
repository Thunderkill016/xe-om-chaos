export const MENU_CAMERA = Object.freeze({
  position: Object.freeze({ x: 3, y: 5.8, z: -57 }),
  target: Object.freeze({ x: 3, y: 1.6, z: -18 }),
});

function insideRect(x, z, rect, margin) {
  return (
    Math.abs(x - rect.x) <= rect.w * 0.5 + margin &&
    Math.abs(z - rect.z) <= rect.d * 0.5 + margin
  );
}

/**
 * Pull a chase camera toward the rider when a visible building blocks the
 * player-to-camera line. This is intentionally 2D: the authored building
 * rectangles are the same visible masses used by gameplay collision.
 *
 * @param {{x:number,z:number}} player
 * @param {{x:number,z:number}} desired
 * @param {{x:number,z:number,w:number,d:number}[]} rects
 * @param {number} margin
 */
export function resolveCameraPosition(player, desired, rects, margin = 0.45) {
  const dx = desired.x - player.x;
  const dz = desired.z - player.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.01) return { ...desired };

  const steps = Math.max(12, Math.ceil(distance * 2.2));
  for (let i = 2; i <= steps; i++) {
    const t = i / steps;
    const x = player.x + dx * t;
    const z = player.z + dz * t;
    if (!rects.some((rect) => insideRect(x, z, rect, margin))) continue;

    const safeT = Math.max(0.1, (i - 1.5) / steps);
    return {
      x: player.x + dx * safeT,
      z: player.z + dz * safeT,
    };
  }

  return { ...desired };
}
