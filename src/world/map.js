export const AVENUES = [-72, 0, 72];
export const ALLEYS = [-36, 36];
export const EXTENT = 89;
export const ROAD_HALF = 7;
export const ALLEY_HALF = 2.5;
// A hand-authored dogleg between two streets. Its courtyard replaces a building
// lot; rendering and collision share this path so the shortcut is actually usable.
export const HIDDEN_LANES = [
  {
    id: "hem26",
    name: "HẺM 26",
    width: 4.6,
    points: [
      { x: 0, z: -24 },
      { x: 17, z: -24 },
      { x: 17, z: -12 },
      { x: 36, z: -12 },
    ],
  },
];
export function segmentDistance(x, z, a, b) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
  );
  return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
}
export function hiddenLaneAt(x, z, margin = 0) {
  return HIDDEN_LANES.find((lane) =>
    lane.points
      .slice(1)
      .some(
        (b, i) =>
          segmentDistance(x, z, lane.points[i], b) < lane.width / 2 - margin,
      ),
  );
}
export const STOPS = [
  // Board before the hẻm entrance so choosing it never requires a U-turn.
  { x: 3, z: -30, name: "CÀ PHÊ MÂY NHỎ" },
  { x: 68, z: 36, name: "BẾN GIÓ" },
  { x: -36, z: 68, name: "CHỢ AN HÒA" },
  { x: -68, z: -36, name: "CƠM TẤM CÔ BẢY" },
  {
    ...HIDDEN_LANES[0].points[HIDDEN_LANES[0].points.length - 1],
    name: "HẺM 26",
  },
  { x: -3, z: 58, name: "CHUNG CƯ NẮNG" },
];
export function surface(x, z, margin = 0) {
  if (Math.abs(x) > EXTENT - margin || Math.abs(z) > EXTENT - margin)
    return "wall";
  if (
    AVENUES.some(
      (v) =>
        Math.abs(x - v) < ROAD_HALF - margin ||
        Math.abs(z - v) < ROAD_HALF - margin,
    )
  )
    return "road";
  if (
    Math.abs(x) < 73 &&
    Math.abs(z) < 73 &&
    ALLEYS.some(
      (v) =>
        Math.abs(x - v) < ALLEY_HALF - margin ||
        Math.abs(z - v) < ALLEY_HALF - margin,
    )
  )
    return "alley";
  if (hiddenLaneAt(x, z, margin)) return "alley";
  return "wall";
}
export function district(x, z) {
  if (x > 62) return "BẾN GIÓ";
  if (x < -20 && z > 15) return "CHỢ AN HÒA";
  if (x < -20 && z < -15) return "PHỐ ĂN ĐÊM";
  if (x > 15 && z < -15) return "HẺM 26";
  if (z > 20) return "CHUNG CƯ NẮNG";
  return "ĐẠI LỘ SÀI GÒN";
}
export function makeTraffic(rng, count) {
  return Array.from({ length: count }, (_, id) => {
    const row = Math.floor(rng() * 2),
      col = Math.floor(rng() * 2);
    const left = -72 + col * 72,
      top = -72 + row * 72;
    const direction = rng() > 0.3 ? 1 : -1;
    const kind = id % 11 === 0 ? "car" : id % 7 === 0 ? "delivery" : "bike";
    return {
      id,
      left,
      top,
      direction,
      phase: rng() * 288,
      speed: 5 + rng() * 6,
      kind,
      x: 0,
      z: 0,
      angle: 0,
      radius: kind === "car" ? 1.5 : 0.72,
      near: false,
      closest: Infinity,
      nearSide: 0,
      lastNear: -100,
      honkedUntil: 0,
      active: true,
      colour: Math.floor(rng() * 5),
    };
  });
}
export function trafficPose(vehicle, time) {
  const p =
    (((vehicle.phase + time * vehicle.speed * vehicle.direction) % 288) + 288) %
    288;
  const lane =
    2.8 * vehicle.direction +
    (vehicle.honkedUntil > time ? 1.2 * vehicle.direction : 0);
  if (p < 72) {
    vehicle.x = vehicle.left + p;
    vehicle.z = vehicle.top + lane;
    vehicle.angle = Math.PI / 2;
  } else if (p < 144) {
    vehicle.x = vehicle.left + 72 - lane;
    vehicle.z = vehicle.top + p - 72;
    vehicle.angle = 0;
  } else if (p < 216) {
    vehicle.x = vehicle.left + 216 - p;
    vehicle.z = vehicle.top + 72 - lane;
    vehicle.angle = -Math.PI / 2;
  } else {
    vehicle.x = vehicle.left + lane;
    vehicle.z = vehicle.top + 288 - p;
    vehicle.angle = Math.PI;
  }
  if (vehicle.direction < 0) vehicle.angle += Math.PI;
}
