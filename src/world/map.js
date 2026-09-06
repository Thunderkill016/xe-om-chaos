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

// Twelve stable streams: two directions on each of the three horizontal and
// three vertical avenues. Vehicles within one stream share pace and spacing, so
// they cannot catch and stack into one another. This is intentionally simpler
// than lane-changing AI while the core traffic interaction is being stabilized.
const TRAFFIC_STREAMS = AVENUES.length * 4;
const TRAFFIC_MIN = -EXTENT + 2;
const TRAFFIC_MAX = EXTENT - 2;
const TRAFFIC_PERIOD = TRAFFIC_MAX - TRAFFIC_MIN;
const GOLDEN_FRACTION = 0.3819660112501051;

function streamLayout(stream) {
  const vertical = stream >= AVENUES.length * 2;
  const local = vertical ? stream - AVENUES.length * 2 : stream;
  const road = AVENUES[Math.floor(local / 2)];
  const direction = local % 2 === 0 ? 1 : -1;
  return {
    axis: vertical ? "z" : "x",
    road,
    direction,
    // Right-hand road placement from the vehicle's point of view.
    lane: vertical ? road - direction * 2.75 : road + direction * 2.75,
  };
}

function vehicleShape(kind) {
  if (kind === "car") return { halfWidth: 1.05, halfLength: 1.8 };
  if (kind === "delivery") return { halfWidth: 0.58, halfLength: 1.28 };
  return { halfWidth: 0.46, halfLength: 1.18 };
}

export function makeTraffic(rng, regularCount, rushCount = 0) {
  const total = regularCount + rushCount;
  const streamOffsets = Array.from({ length: TRAFFIC_STREAMS }, (_, stream) =>
    (rng() * 0.2 + stream * GOLDEN_FRACTION) % 1,
  );
  // Tiny per-stream differences stop the whole grid looking mechanically synced,
  // while every vehicle inside a stream keeps exactly the same pace.
  const streamSpeeds = Array.from(
    { length: TRAFFIC_STREAMS },
    (_, stream) => 6.15 + (stream % 3) * 0.18 + rng() * 0.18,
  );

  return Array.from({ length: total }, (_, id) => {
    const rushOnly = id >= regularCount;
    const localId = rushOnly ? id - regularCount : id;
    const localCount = rushOnly ? rushCount : regularCount;
    const stream = localId % TRAFFIC_STREAMS;
    const slot = Math.floor(localId / TRAFFIC_STREAMS);
    const slotsInStream = Math.ceil(
      Math.max(0, localCount - stream) / TRAFFIC_STREAMS,
    );
    const layout = streamLayout(stream);
    const offset = streamOffsets[stream];
    // Rush adds one extra vehicle into each stream gap when counts are multiples
    // of twelve. It no longer creates a random pile at an intersection.
    const fraction = rushOnly
      ? ((slot + 0.5) / Math.max(1, slotsInStream) + offset) % 1
      : (slot / Math.max(1, slotsInStream) + offset) % 1;
    const kind = id % 11 === 0 ? "car" : id % 7 === 0 ? "delivery" : "bike";
    return {
      id,
      ...layout,
      stream,
      rushOnly,
      phase: fraction * TRAFFIC_PERIOD,
      speed: streamSpeeds[stream],
      kind,
      ...vehicleShape(kind),
      x: 0,
      z: 0,
      angle: 0,
      near: false,
      closest: Infinity,
      nearSide: 0,
      lastNear: -100,
      honkedAt: -100,
      honkedUntil: 0,
      spawnBlocked: false,
      active: !rushOnly,
      colour: Math.floor(rng() * 5),
    };
  });
}

function wrap(value, period) {
  return ((value % period) + period) % period;
}

function legacyTrafficPose(vehicle, time) {
  const lane = vehicle.lane ?? 2.8 * vehicle.direction;
  const side = vehicle.sideLength ?? 72 - 2 * lane;
  const period = vehicle.phasePeriod ?? side * 4;
  const left = vehicle.left,
    top = vehicle.top;
  const a = { x: left + lane, z: top + lane },
    b = { x: left + 72 - lane, z: top + lane },
    c = { x: left + 72 - lane, z: top + 72 - lane },
    d = { x: left + lane, z: top + 72 - lane };
  const points = vehicle.direction > 0 ? [a, b, c, d, a] : [a, d, c, b, a];
  const travel = wrap(vehicle.phase + time * vehicle.speed, period);
  const segment = Math.min(3, Math.floor(travel / side));
  const local = (travel - segment * side) / side;
  const from = points[segment],
    to = points[segment + 1];
  vehicle.x = from.x + (to.x - from.x) * local;
  vehicle.z = from.z + (to.z - from.z) * local;
  vehicle.angle = Math.atan2(to.x - from.x, to.z - from.z);
}

export function trafficPose(vehicle, time) {
  // Preserve old diagnostic fixtures that hand-author the former block-loop fields.
  if (!vehicle.axis) legacyTrafficPose(vehicle, time);
  else {
    const travel =
      TRAFFIC_MIN +
      wrap(vehicle.phase + time * vehicle.speed, TRAFFIC_PERIOD);
    if (vehicle.axis === "x") {
      vehicle.x = vehicle.direction > 0 ? travel : -travel;
      vehicle.z = vehicle.lane;
      vehicle.angle = vehicle.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      vehicle.x = vehicle.lane;
      vehicle.z = vehicle.direction > 0 ? travel : -travel;
      vehicle.angle = vehicle.direction > 0 ? 0 : Math.PI;
    }
  }

  // Horn response is a smooth temporary nudge inside the current road, not a
  // lane teleport. Local avoidance can layer on top of this in the simulation.
  if (vehicle.honkedUntil > time && vehicle.honkedAt <= time) {
    const duration = Math.max(0.001, vehicle.honkedUntil - vehicle.honkedAt);
    const progress = Math.min(1, Math.max(0, (time - vehicle.honkedAt) / duration));
    const nudge = Math.sin(progress * Math.PI) * 0.42;
    vehicle.x += Math.cos(vehicle.angle) * nudge;
    vehicle.z -= Math.sin(vehicle.angle) * nudge;
  }
}

// Circle-vs-oriented-box clearance. Negative means the point lies inside the
// traffic body's footprint. It matches the visible car/bike proportions much
// better than the old single radius for every direction.
export function vehicleClearance(vehicle, point) {
  const dx = point.x - vehicle.x,
    dz = point.z - vehicle.z;
  const sideX = Math.cos(vehicle.angle),
    sideZ = -Math.sin(vehicle.angle),
    forwardX = Math.sin(vehicle.angle),
    forwardZ = Math.cos(vehicle.angle);
  const lateral = dx * sideX + dz * sideZ,
    longitudinal = dx * forwardX + dz * forwardZ;
  const halfWidth = vehicle.halfWidth ?? (vehicle.kind === "car" ? 1.05 : 0.46),
    halfLength = vehicle.halfLength ?? (vehicle.kind === "car" ? 1.8 : 1.18);
  const ox = Math.abs(lateral) - halfWidth,
    oz = Math.abs(longitudinal) - halfLength;
  if (ox <= 0 && oz <= 0) return Math.max(ox, oz);
  return Math.hypot(Math.max(0, ox), Math.max(0, oz));
}
