export const AVENUES = [-72, 0, 72];
export const ALLEYS = [-36, 36];
export const EXTENT = 89;
export const ROAD_HALF = 7;
export const ALLEY_HALF = 2.5;
const SIDEWALK_HALF = 10.5;
const ALLEY_SHOULDER_HALF = 4.6;

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

// The city renderer uses the same deterministic block layout. These rectangles
// represent the large visible masses that should actually stop the bike. Low
// street furniture stays forgiving on purpose; the old implementation treated
// every centimetre outside a painted road as an invisible wall.
const BLOCK_STARTS = [-65, -33, 7, 39];
export const BUILDING_RECTS = [];
for (let ix = 0; ix < BLOCK_STARTS.length; ix++)
  for (let iz = 0; iz < BLOCK_STARTS.length; iz++) {
    const x0 = BLOCK_STARTS[ix],
      z0 = BLOCK_STARTS[iz];
    if (x0 === 7 && z0 === -33) continue;
    for (let n = 0; n < 3; n++) {
      const x =
          x0 +
          4.5 +
          n * 8.4 +
          (n === 0 && ix % 2 === 0 ? 1 : n === 2 && ix % 2 === 1 ? -1 : 0),
        w =
          n === 0 && ix % 2 === 0
            ? 5.4
            : n === 2 && ix % 2 === 1
              ? 5.1
              : [7.4, 8.1, 7.1][n];
      BUILDING_RECTS.push({ x, z: z0 + 7, w, d: 8.8 });
      BUILDING_RECTS.push({ x, z: z0 + 19, w, d: 8.5 });
    }
  }
BUILDING_RECTS.push(
  { x: 11.2, z: -30, w: 3.6, d: 6 },
  { x: 26.5, z: -25, w: 13, d: 16 },
  { x: 11.2, z: -13.5, w: 3.6, d: 13 },
  { x: -53, z: 52, w: 22, d: 20 },
);

export function buildingAt(x, z, margin = 0) {
  return BUILDING_RECTS.find(
    (rect) =>
      Math.abs(x - rect.x) < rect.w / 2 + margin &&
      Math.abs(z - rect.z) < rect.d / 2 + margin,
  );
}

export function surface(x, z, margin = 0) {
  if (Math.abs(x) > EXTENT - margin || Math.abs(z) > EXTENT - margin)
    return "wall";
  if (buildingAt(x, z, margin)) return "wall";

  const avenue = AVENUES.some(
    (v) =>
      Math.abs(x - v) < ROAD_HALF - margin ||
      Math.abs(z - v) < ROAD_HALF - margin,
  );
  if (avenue) return "road";

  const alley =
    Math.abs(x) < 73 &&
    Math.abs(z) < 73 &&
    ALLEYS.some(
      (v) =>
        Math.abs(x - v) < ALLEY_HALF - margin ||
        Math.abs(z - v) < ALLEY_HALF - margin,
    );
  if (alley) return "alley";
  if (hiddenLaneAt(x, z, margin)) return "alley";

  // The visible curb/sidewalk apron is traversable. It is intentionally slower
  // only through player judgement for now; most importantly it is no longer an
  // invisible collision wall next to open pavement.
  if (
    AVENUES.some(
      (v) =>
        Math.abs(x - v) < SIDEWALK_HALF - margin ||
        Math.abs(z - v) < SIDEWALK_HALF - margin,
    )
  )
    return "ground";
  if (
    Math.abs(x) < 75 &&
    Math.abs(z) < 75 &&
    ALLEYS.some(
      (v) =>
        Math.abs(x - v) < ALLEY_SHOULDER_HALF - margin ||
        Math.abs(z - v) < ALLEY_SHOULDER_HALF - margin,
    )
  )
    return "ground";

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

// Twelve stable streams: two directions on each of three horizontal and three
// vertical avenues. All streams use the same pace so one scripted NPC cannot
// catch and overlap the next one. The phase offsets keep perpendicular streams
// separated at the nine avenue intersections across the repeating cycle.
const TRAFFIC_STREAMS = AVENUES.length * 4;
const TRAFFIC_MIN = -EXTENT + 2;
const TRAFFIC_MAX = EXTENT - 2;
const TRAFFIC_PERIOD = TRAFFIC_MAX - TRAFFIC_MIN;
const TRAFFIC_SLOT_SPACING = TRAFFIC_PERIOD / 3;
const TRAFFIC_SPEED = 6.25;
const TRAFFIC_PHASES = [
  12.52, 46.31, 32.33, 3.13, 38.46, 18.24, 32.34, 19.98, 17.5, 46.32, 2.98,
  40.95,
];

function streamLayout(stream) {
  const vertical = stream >= AVENUES.length * 2;
  const local = vertical ? stream - AVENUES.length * 2 : stream;
  const road = AVENUES[Math.floor(local / 2)];
  const direction = local % 2 === 0 ? 1 : -1;
  return {
    axis: vertical ? "z" : "x",
    road,
    direction,
    // Coordinates use +x east and +z north. Keep traffic on the right-hand
    // side of its direction of travel: north/east use +x/-z respectively.
    lane: vertical ? road + direction * 2.75 : road - direction * 2.75,
  };
}

function vehicleShape(kind) {
  if (kind === "car") return { halfWidth: 1.05, halfLength: 1.8 };
  if (kind === "delivery") return { halfWidth: 0.58, halfLength: 1.28 };
  return { halfWidth: 0.46, halfLength: 1.18 };
}

function wrap(value, period) {
  return ((value % period) + period) % period;
}

export function makeTraffic(rng, regularCount, rushCount = 0) {
  const total = regularCount + rushCount;
  // A daily global rotation changes where the whole pattern starts without
  // destroying the safe relative cadence between crossing streams.
  const dailyShift = rng() * TRAFFIC_SLOT_SPACING;
  const regularSlots = Math.ceil(regularCount / TRAFFIC_STREAMS);

  return Array.from({ length: total }, (_, id) => {
    const rushOnly = id >= regularCount;
    const localId = rushOnly ? id - regularCount : id;
    const stream = localId % TRAFFIC_STREAMS;
    const localSlot = Math.floor(localId / TRAFFIC_STREAMS);
    const slot = rushOnly ? regularSlots + localSlot : localSlot;
    const layout = streamLayout(stream);
    const kind = id % 11 === 0 ? "car" : id % 7 === 0 ? "delivery" : "bike";
    return {
      id,
      ...layout,
      stream,
      rushOnly,
      phase: wrap(
        TRAFFIC_PHASES[stream] + dailyShift + slot * TRAFFIC_SLOT_SPACING,
        TRAFFIC_PERIOD,
      ),
      speed: TRAFFIC_SPEED,
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

function legacyTrafficPose(vehicle, time, explicitLegacy = false) {
  const lane = explicitLegacy
    ? 2.8 * vehicle.direction
    : (vehicle.lane ?? 2.8 * vehicle.direction);
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
  // Diagnostic fixtures predate straight streams and still hand-author left/top.
  // Honour those explicit fixture fields even if the object was cloned from a
  // modern traffic vehicle that also carries an axis/lane property.
  const hasLegacyRoute =
    Number.isFinite(vehicle.left) && Number.isFinite(vehicle.top);
  if (hasLegacyRoute || !vehicle.axis)
    legacyTrafficPose(vehicle, time, hasLegacyRoute);
  else {
    const travel =
      TRAFFIC_MIN + wrap(vehicle.phase + time * vehicle.speed, TRAFFIC_PERIOD);
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

  // Horn response is a smooth temporary nudge inside the current road, not a lane teleport.
  if (vehicle.honkedUntil > time && vehicle.honkedAt <= time) {
    const duration = Math.max(0.001, vehicle.honkedUntil - vehicle.honkedAt);
    const progress = Math.min(
      1,
      Math.max(0, (time - vehicle.honkedAt) / duration),
    );
    const nudge = Math.sin(progress * Math.PI) * 0.42;
    vehicle.x += Math.cos(vehicle.angle) * nudge;
    vehicle.z -= Math.sin(vehicle.angle) * nudge;
  }
}

// Circle-vs-oriented-box clearance. Negative means the point lies inside the
// traffic body's footprint. Derive the footprint from kind at collision time so
// the visual vehicle class and the collision class cannot silently diverge.
export function vehicleClearance(vehicle, point) {
  const dx = point.x - vehicle.x,
    dz = point.z - vehicle.z;
  const sideX = Math.cos(vehicle.angle),
    sideZ = -Math.sin(vehicle.angle),
    forwardX = Math.sin(vehicle.angle),
    forwardZ = Math.cos(vehicle.angle);
  const lateral = dx * sideX + dz * sideZ,
    longitudinal = dx * forwardX + dz * forwardZ;
  const { halfWidth, halfLength } = vehicleShape(vehicle.kind);
  const ox = Math.abs(lateral) - halfWidth,
    oz = Math.abs(longitudinal) - halfLength;
  if (ox <= 0 && oz <= 0) return Math.max(ox, oz);
  return Math.hypot(Math.max(0, ox), Math.max(0, oz));
}
