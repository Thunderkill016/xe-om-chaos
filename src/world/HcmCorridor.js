import { HCMC_OSM_DATA } from "./hcm-downtown-data.js";
import {
  STOPS as MAP_STOPS,
  collisionSurface as mapCollisionSurface,
  makeTraffic as makeMapTraffic,
  trafficPose as mapTrafficPose,
} from "./map.js";

/** @typedef {[number, number]} OsmPoint */
/** @typedef {[string, number, OsmPoint[]]} OsmRoad */
/** @typedef {[number, number, number, number, number, number, string]} OsmBuilding */
/** @typedef {{x:number,z:number,w:number,d:number,h:number,angle:number,kind:string}} CorridorBuilding */

const ANCHOR = Object.freeze({ x: 0, z: 72 });
// The real Bến Thành -> Lê Lợi -> Nguyễn Huệ span is about 588m. Compressing
// that source distance to ~79m keeps the game legible while preserving the
// actual boulevard bearing and relative landmark placement.
const PLAY_SCALE = 0.135;
export const REAL_HCM_BUILDING_CLEARANCE = 1.8;
const OSM_SOUTH = 10.768;
const OSM_WEST = 106.693;
const OSM_NORTH = 10.79;
const OSM_EAST = 106.716;
const METERS_PER_DEG_LAT = 111_320;
const OSM_CENTER_LAT = (OSM_SOUTH + OSM_NORTH) * 0.5;
const OSM_CENTER_LON = (OSM_WEST + OSM_EAST) * 0.5;
const METERS_PER_DEG_LON =
  METERS_PER_DEG_LAT * Math.cos((OSM_CENTER_LAT * Math.PI) / 180);

export const SAIGON_VERTICAL_SLICE = Object.freeze({
  id: "ben-thanh-le-loi-nguyen-hue",
  name: "BẾN THÀNH → LÊ LỢI → NGUYỄN HUỆ",
  start: Object.freeze({
    name: "CHỢ BẾN THÀNH · QUÁCH THỊ TRANG",
    lat: 10.77257,
    lon: 106.69802,
  }),
  end: Object.freeze({
    name: "LÊ LỢI · NGUYỄN HUỆ",
    lat: 10.7743,
    lon: 106.7031,
  }),
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pointDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function projectLatLon(lat, lon) {
  return [
    (lon - OSM_CENTER_LON) * METERS_PER_DEG_LON,
    (lat - OSM_CENTER_LAT) * METERS_PER_DEG_LAT,
  ];
}

function segmentLength(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += segmentLength(points[i - 1], points[i]);
  return length;
}

function distanceToSegment(point, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const denominator = dx * dx + dz * dz;
  if (denominator <= 1e-9) return pointDistance(point, a);
  const t = clamp(
    ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / denominator,
    0,
    1,
  );
  return Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dz * t));
}

function distanceToPolyline(point, points) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++)
    best = Math.min(best, distanceToSegment(point, points[i - 1], points[i]));
  return best;
}

function cross(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointOnSegment(point, a, b) {
  return (
    Math.abs(cross(a, b, point)) < 1e-7 &&
    point[0] >= Math.min(a[0], b[0]) - 1e-7 &&
    point[0] <= Math.max(a[0], b[0]) + 1e-7 &&
    point[1] >= Math.min(a[1], b[1]) - 1e-7 &&
    point[1] <= Math.max(a[1], b[1]) + 1e-7
  );
}

function segmentsIntersect(a, b, c, d) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (
    ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
    ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))
  )
    return true;
  return (
    pointOnSegment(c, a, b) ||
    pointOnSegment(d, a, b) ||
    pointOnSegment(a, c, d) ||
    pointOnSegment(b, c, d)
  );
}

function segmentToSegmentDistance(a, b, c, d) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    distanceToSegment(a, c, d),
    distanceToSegment(b, c, d),
    distanceToSegment(c, a, b),
    distanceToSegment(d, a, b),
  );
}

function interpolateSourceRoute(start, end, steps = 7) {
  return Array.from({ length: steps }, (_, index) => {
    const t = index / (steps - 1);
    return [
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
    ];
  });
}

function transformRoute(sourcePoints) {
  const start = sourcePoints[0];
  const a = sourcePoints[0];
  const b = sourcePoints[1];
  const firstLength = Math.max(1e-6, segmentLength(a, b));
  const firstTangent = [
    (b[0] - a[0]) / firstLength,
    (b[1] - a[1]) / firstLength,
  ];
  const heading = Math.atan2(firstTangent[0], firstTangent[1]);
  const c = Math.cos(-heading);
  const s = Math.sin(-heading);
  const points = sourcePoints.map(([x, z]) => {
    const dx = x - start[0];
    const dz = z - start[1];
    return {
      x: ANCHOR.x + (dx * c - dz * s) * PLAY_SCALE,
      z: ANCHOR.z + (dx * s + dz * c) * PLAY_SCALE,
    };
  });
  return { points, sourceOrigin: start, sourceHeading: heading, c, s };
}

function selectCorridor() {
  const start = projectLatLon(
    SAIGON_VERTICAL_SLICE.start.lat,
    SAIGON_VERTICAL_SLICE.start.lon,
  );
  const end = projectLatLon(
    SAIGON_VERTICAL_SLICE.end.lat,
    SAIGON_VERTICAL_SLICE.end.lon,
  );
  const sourcePoints = interpolateSourceRoute(start, end, 7);
  const transformed = transformRoute(sourcePoints);
  const gamePoints = transformed.points;
  const sourceLength = polylineLength(sourcePoints);
  const gameLength = polylineLength(
    gamePoints.map((point) => [point.x, point.z]),
  );
  const sourceWidth = 36;
  const width = clamp(sourceWidth * PLAY_SCALE, 4.8, 6.4);
  return {
    id: "hcm-osm-corridor-1",
    name: SAIGON_VERTICAL_SLICE.name,
    source: "OpenStreetMap + georeferenced HCMC landmarks",
    sourceGeneratedAt: HCMC_OSM_DATA.generatedAt,
    sourceType: "primary",
    sourceWidth,
    sourceLength,
    sourceOrigin: transformed.sourceOrigin,
    sourceHeading: transformed.sourceHeading,
    transformCos: transformed.c,
    transformSin: transformed.s,
    scale: PLAY_SCALE,
    width,
    shoulderWidth: width + 3.4,
    length: gameLength,
    points: gamePoints,
    realWorldStart: SAIGON_VERTICAL_SLICE.start,
    realWorldEnd: SAIGON_VERTICAL_SLICE.end,
  };
}

export const REAL_HCM_CORRIDOR = Object.freeze(selectCorridor());

function sampleRoute(distanceValue) {
  const distance = clamp(distanceValue, 0, REAL_HCM_CORRIDOR.length);
  let travelled = 0;
  for (let i = 1; i < REAL_HCM_CORRIDOR.points.length; i++) {
    const a = REAL_HCM_CORRIDOR.points[i - 1];
    const b = REAL_HCM_CORRIDOR.points[i];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (
      travelled + length >= distance ||
      i === REAL_HCM_CORRIDOR.points.length - 1
    ) {
      const t =
        length <= 1e-6 ? 0 : clamp((distance - travelled) / length, 0, 1);
      const tx = length <= 1e-6 ? 0 : (b.x - a.x) / length;
      const tz = length <= 1e-6 ? 1 : (b.z - a.z) / length;
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        tx,
        tz,
      };
    }
    travelled += length;
  }
  const point = REAL_HCM_CORRIDOR.points.at(-1);
  return { ...point, tx: 0, tz: 1 };
}

export function realSourceToGame(x, z) {
  const dx = x - REAL_HCM_CORRIDOR.sourceOrigin[0];
  const dz = z - REAL_HCM_CORRIDOR.sourceOrigin[1];
  return {
    x:
      ANCHOR.x +
      (dx * REAL_HCM_CORRIDOR.transformCos -
        dz * REAL_HCM_CORRIDOR.transformSin) *
        PLAY_SCALE,
    z:
      ANCHOR.z +
      (dx * REAL_HCM_CORRIDOR.transformSin +
        dz * REAL_HCM_CORRIDOR.transformCos) *
        PLAY_SCALE,
  };
}

function corridorBuildingCorners(building) {
  const halfW = building.w * 0.5;
  const halfD = building.d * 0.5;
  const c = Math.cos(building.angle);
  const s = Math.sin(building.angle);
  return [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ].map(([localX, localZ]) => [
    building.x + localX * c + localZ * s,
    building.z - localX * s + localZ * c,
  ]);
}

export function realCorridorBuildingClearance(building) {
  const corners = corridorBuildingCorners(building);
  let best = Infinity;
  for (let edge = 0; edge < corners.length; edge++) {
    const a = corners[edge];
    const b = corners[(edge + 1) % corners.length];
    for (let i = 1; i < REAL_HCM_CORRIDOR.points.length; i++) {
      const c = REAL_HCM_CORRIDOR.points[i - 1];
      const d = REAL_HCM_CORRIDOR.points[i];
      best = Math.min(
        best,
        segmentToSegmentDistance(a, b, [c.x, c.z], [d.x, d.z]),
      );
      if (best === 0) return 0;
    }
  }
  return best;
}

function buildCorridorBuildings() {
  const sourcePoints = REAL_HCM_CORRIDOR.points.map((point) => {
    const dx = (point.x - ANCHOR.x) / PLAY_SCALE;
    const dz = (point.z - ANCHOR.z) / PLAY_SCALE;
    const c = Math.cos(REAL_HCM_CORRIDOR.sourceHeading);
    const s = Math.sin(REAL_HCM_CORRIDOR.sourceHeading);
    return [
      REAL_HCM_CORRIDOR.sourceOrigin[0] + dx * c - dz * s,
      REAL_HCM_CORRIDOR.sourceOrigin[1] + dx * s + dz * c,
    ];
  });
  /** @type {CorridorBuilding[]} */
  const buildings = [];
  /** @type {OsmBuilding[]} */
  const osmBuildings = /** @type {OsmBuilding[]} */ (HCMC_OSM_DATA.buildings);
  const requiredClearance =
    REAL_HCM_CORRIDOR.shoulderWidth * 0.5 + REAL_HCM_BUILDING_CLEARANCE;
  for (const source of osmBuildings) {
    const [sx, sz, sw, sd, sh, sourceAngle, kind] = source;
    const sourceDistance = distanceToPolyline([sx, sz], sourcePoints);
    if (sourceDistance > 90) continue;
    const position = realSourceToGame(sx, sz);
    if (
      position.z < ANCHOR.z - 14 ||
      position.z >
        Math.max(...REAL_HCM_CORRIDOR.points.map((point) => point.z)) + 30 ||
      Math.abs(position.x - ANCHOR.x) > 62
    )
      continue;
    const building = {
      x: position.x,
      z: position.z,
      w: clamp(sw * PLAY_SCALE, 2.1, 18),
      d: clamp(sd * PLAY_SCALE, 2.1, 18),
      h: clamp(sh * 0.22, 3, 30),
      angle: sourceAngle - REAL_HCM_CORRIDOR.sourceHeading,
      kind,
    };
    if (realCorridorBuildingClearance(building) < requiredClearance) continue;
    buildings.push(building);
    if (buildings.length >= 96) break;
  }
  return buildings;
}

export const REAL_HCM_CORRIDOR_BUILDINGS = Object.freeze(
  buildCorridorBuildings(),
);

function pointToGameSegmentDistance(x, z, a, b) {
  return distanceToSegment([x, z], [a.x, a.z], [b.x, b.z]);
}

export function realCorridorDistance(x, z) {
  let best = Infinity;
  for (let i = 1; i < REAL_HCM_CORRIDOR.points.length; i++)
    best = Math.min(
      best,
      pointToGameSegmentDistance(
        x,
        z,
        REAL_HCM_CORRIDOR.points[i - 1],
        REAL_HCM_CORRIDOR.points[i],
      ),
    );
  return best;
}

export function realCorridorBuildingAt(x, z, margin = 0) {
  return REAL_HCM_CORRIDOR_BUILDINGS.find((building) => {
    const dx = x - building.x;
    const dz = z - building.z;
    const c = Math.cos(building.angle);
    const s = Math.sin(building.angle);
    const localX = dx * c - dz * s;
    const localZ = dx * s + dz * c;
    return (
      Math.abs(localX) < building.w * 0.5 + margin &&
      Math.abs(localZ) < building.d * 0.5 + margin
    );
  });
}

export function realCorridorSurface(x, z, margin = 0) {
  if (realCorridorBuildingAt(x, z, margin)) return "wall";
  const distance = realCorridorDistance(x, z);
  if (distance < REAL_HCM_CORRIDOR.width * 0.5 - margin) return "road";
  if (distance < REAL_HCM_CORRIDOR.shoulderWidth * 0.5 - margin)
    return "ground";
  return null;
}

export function worldCollisionSurface(x, z, margin = 0) {
  const corridor = realCorridorSurface(x, z, margin);
  return corridor ?? mapCollisionSurface(x, z, margin);
}

const stopA = sampleRoute(Math.min(9, REAL_HCM_CORRIDOR.length * 0.18));
const stopB = sampleRoute(
  Math.max(REAL_HCM_CORRIDOR.length - 9, REAL_HCM_CORRIDOR.length * 0.72),
);
export const REAL_HCM_CORRIDOR_STOPS = Object.freeze([
  {
    x: stopA.x,
    z: stopA.z,
    name: "CHỢ BẾN THÀNH · LÊ LỢI",
    realHcm: true,
  },
  {
    x: stopB.x,
    z: stopB.z,
    name: "LÊ LỢI · NGUYỄN HUỆ",
    realHcm: true,
  },
]);
export const WORLD_STOPS = Object.freeze([
  ...MAP_STOPS,
  ...REAL_HCM_CORRIDOR_STOPS,
]);

export function makeWorldTraffic(rng, regularCount, rushCount = 0) {
  const traffic = makeMapTraffic(rng, regularCount, rushCount);
  const corridorCount = Math.min(4, regularCount);
  const first = regularCount - corridorCount;
  for (let id = first; id < regularCount; id++) {
    /** @type {any} */
    const vehicle = traffic[id];
    const slot = id - first;
    vehicle.route = REAL_HCM_CORRIDOR.id;
    vehicle.axis = null;
    vehicle.road = null;
    vehicle.lane = slot % 2 === 0 ? -1 : 1;
    vehicle.kind = slot % 3 === 0 ? "car" : slot % 3 === 1 ? "bike" : "delivery";
    vehicle.corridorDistance =
      ((slot + 0.5) / corridorCount) * REAL_HCM_CORRIDOR.length;
    vehicle.corridorDirection = slot % 2 === 0 ? 1 : -1;
    vehicle.speed = 4.8 + rng() * 1.7;
    vehicle.desiredSpeed = vehicle.speed;
    vehicle.active = true;
  }
  return traffic;
}

function corridorTrafficPose(vehicle) {
  const distance =
    vehicle.corridorDirection > 0
      ? vehicle.corridorDistance
      : REAL_HCM_CORRIDOR.length - vehicle.corridorDistance;
  const pose = sampleRoute(distance);
  const halfLane = Math.max(0.75, REAL_HCM_CORRIDOR.width * 0.23);
  const nx = -pose.tz;
  const nz = pose.tx;
  return {
    x: pose.x + nx * halfLane * vehicle.lane,
    z: pose.z + nz * halfLane * vehicle.lane,
    angle: Math.atan2(pose.tx, pose.tz) +
      (vehicle.corridorDirection < 0 ? Math.PI : 0),
  };
}

export function worldTrafficPose(vehicle, time) {
  if (vehicle.route === REAL_HCM_CORRIDOR.id) return corridorTrafficPose(vehicle);
  return mapTrafficPose(vehicle, time);
}

export function stepWorldTraffic(vehicle, dt) {
  if (vehicle.route !== REAL_HCM_CORRIDOR.id) return;
  vehicle.corridorDistance += vehicle.speed * dt;
  if (vehicle.corridorDistance > REAL_HCM_CORRIDOR.length)
    vehicle.corridorDistance -= REAL_HCM_CORRIDOR.length;
}
