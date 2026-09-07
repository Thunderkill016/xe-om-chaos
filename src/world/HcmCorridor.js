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
const PLAY_SCALE = 0.34;
const TARGET_SOURCE_LENGTH = 235;
const MAX_CHAIN_ROADS = 8;
const ENDPOINT_EPSILON = 2.2;
const DRIVABLE_TYPES = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "living_street",
  "unclassified",
  "service",
]);
const TYPE_BONUS = {
  motorway: 34,
  trunk: 32,
  primary: 30,
  secondary: 27,
  tertiary: 23,
  residential: 16,
  living_street: 13,
  unclassified: 12,
  service: 6,
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pointDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

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

function tangent(points, atEnd = false) {
  if (points.length < 2) return [0, 1];
  const a = atEnd ? points.at(-2) : points[0];
  const b = atEnd ? points.at(-1) : points[1];
  const length = Math.max(1e-6, segmentLength(a, b));
  return [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
}

function orientedRoad(road, reverse = false) {
  const points = reverse ? [...road[2]].reverse() : road[2];
  return { type: road[0], width: road[1], points };
}

function stitchRoad(seedIndex, reverse, roads) {
  const seed = orientedRoad(roads[seedIndex], reverse);
  const points = [...seed.points];
  const used = new Set([seedIndex]);
  let sourceLength = polylineLength(points);
  let dominantType = seed.type;
  let sourceWidth = seed.width;

  while (sourceLength < TARGET_SOURCE_LENGTH && used.size < MAX_CHAIN_ROADS) {
    const tail = points.at(-1);
    const currentTangent = tangent(points, true);
    let best = null;

    for (let index = 0; index < roads.length; index++) {
      if (used.has(index)) continue;
      const road = roads[index];
      for (const candidateReverse of [false, true]) {
        const candidate = orientedRoad(road, candidateReverse);
        if (pointDistance(tail, candidate.points[0]) > ENDPOINT_EPSILON)
          continue;
        const nextTangent = tangent(candidate.points);
        const dot =
          currentTangent[0] * nextTangent[0] +
          currentTangent[1] * nextTangent[1];
        if (dot < -0.25) continue;
        const length = polylineLength(candidate.points);
        const score =
          dot * 28 + length * 0.045 + (TYPE_BONUS[candidate.type] ?? 0);
        if (!best || score > best.score)
          best = { index, candidate, length, score };
      }
    }

    if (!best) break;
    used.add(best.index);
    points.push(...best.candidate.points.slice(1));
    sourceLength += best.length;
    if (
      (TYPE_BONUS[best.candidate.type] ?? 0) > (TYPE_BONUS[dominantType] ?? 0)
    )
      dominantType = best.candidate.type;
    sourceWidth = Math.max(sourceWidth, best.candidate.width);
  }

  return { points, sourceLength, dominantType, sourceWidth, used: [...used] };
}

function trimPolyline(points, maxLength) {
  if (points.length < 2) return points;
  const result = [points[0]];
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = segmentLength(a, b);
    if (travelled + length <= maxLength) {
      result.push(b);
      travelled += length;
      continue;
    }
    const remain = maxLength - travelled;
    if (remain > 0.5) {
      const t = remain / length;
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    break;
  }
  return result;
}

function transformRoute(sourcePoints) {
  const start = sourcePoints[0];
  const firstTangent = tangent(sourcePoints);
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

function candidateScore(chain, transformed) {
  const gameLength = polylineLength(
    transformed.points.map((point) => [point.x, point.z]),
  );
  const end = transformed.points.at(-1);
  const forward = end.z - ANCHOR.z;
  const maxLateral = Math.max(
    ...transformed.points.map((point) => Math.abs(point.x - ANCHOR.x)),
  );
  const minForward = Math.min(
    ...transformed.points.map((point) => point.z - ANCHOR.z),
  );
  if (gameLength < 22 || forward < 12 || maxLateral > 58 || minForward < -18)
    return -Infinity;
  const sourceCenterDistance = Math.hypot(
    chain.points[0][0],
    chain.points[0][1],
  );
  return (
    gameLength * 1.5 +
    forward * 1.2 -
    maxLateral * 0.45 -
    sourceCenterDistance * 0.004 +
    (TYPE_BONUS[chain.dominantType] ?? 0) +
    Math.min(12, chain.points.length * 0.8)
  );
}

function selectCorridor() {
  /** @type {OsmRoad[]} */
  const osmRoads = /** @type {OsmRoad[]} */ (HCMC_OSM_DATA.roads);
  const roads = osmRoads.filter(
    (road) =>
      DRIVABLE_TYPES.has(road[0]) &&
      road[2]?.length >= 2 &&
      polylineLength(road[2]) >= 22,
  );
  let best = null;
  for (let index = 0; index < roads.length; index++) {
    for (const reverse of [false, true]) {
      const chain = stitchRoad(index, reverse, roads);
      const sourcePoints = trimPolyline(chain.points, TARGET_SOURCE_LENGTH);
      const transformed = transformRoute(sourcePoints);
      const score = candidateScore(chain, transformed);
      if (!best || score > best.score)
        best = { score, chain, sourcePoints, transformed };
    }
  }

  if (!best || !Number.isFinite(best.score)) {
    const fallback = roads.reduce(
      (winner, road) =>
        !winner || polylineLength(road[2]) > polylineLength(winner[2])
          ? road
          : winner,
      null,
    );
    if (!fallback)
      throw new Error("HCMC OSM asset contains no driveable road geometry");
    const sourcePoints = trimPolyline(fallback[2], TARGET_SOURCE_LENGTH);
    const transformed = transformRoute(sourcePoints);
    best = {
      score: 0,
      chain: {
        dominantType: fallback[0],
        sourceWidth: fallback[1],
        sourceLength: polylineLength(sourcePoints),
        used: [],
      },
      sourcePoints,
      transformed,
    };
  }

  const gamePoints = best.transformed.points;
  const gameLength = polylineLength(
    gamePoints.map((point) => [point.x, point.z]),
  );
  const width = clamp(best.chain.sourceWidth * PLAY_SCALE, 4.8, 6.4);
  return {
    id: "hcm-osm-corridor-1",
    name: "TRUNG TÂM SÀI GÒN · OSM",
    source: "OpenStreetMap",
    sourceGeneratedAt: HCMC_OSM_DATA.generatedAt,
    sourceType: best.chain.dominantType,
    sourceWidth: best.chain.sourceWidth,
    sourceLength: polylineLength(best.sourcePoints),
    sourceOrigin: best.transformed.sourceOrigin,
    sourceHeading: best.transformed.sourceHeading,
    transformCos: best.transformed.c,
    transformSin: best.transformed.s,
    scale: PLAY_SCALE,
    width,
    shoulderWidth: width + 3.2,
    length: gameLength,
    points: gamePoints,
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

function transformSourcePoint(x, z) {
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
  for (const source of osmBuildings) {
    const [sx, sz, sw, sd, sh, sourceAngle, kind] = source;
    const sourceDistance = distanceToPolyline([sx, sz], sourcePoints);
    if (sourceDistance > 58) continue;
    const position = transformSourcePoint(sx, sz);
    if (
      position.z < ANCHOR.z - 12 ||
      position.z >
        Math.max(...REAL_HCM_CORRIDOR.points.map((point) => point.z)) + 24 ||
      Math.abs(position.x - ANCHOR.x) > 56
    )
      continue;
    const w = clamp(sw * PLAY_SCALE, 2.4, 22);
    const d = clamp(sd * PLAY_SCALE, 2.4, 22);
    const h = clamp(sh * 0.22, 3, 30);
    const roadDistance = distanceToPolyline(
      [position.x, position.z],
      REAL_HCM_CORRIDOR.points.map((point) => [point.x, point.z]),
    );
    if (roadDistance < REAL_HCM_CORRIDOR.width * 0.5 + Math.min(w, d) * 0.32)
      continue;
    buildings.push({
      x: position.x,
      z: position.z,
      w,
      d,
      h,
      angle: sourceAngle - REAL_HCM_CORRIDOR.sourceHeading,
      kind,
    });
    if (buildings.length >= 84) break;
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
  { x: stopA.x, z: stopA.z, name: "TRUNG TÂM · ĐIỂM A", realHcm: true },
  { x: stopB.x, z: stopB.z, name: "TRUNG TÂM · ĐIỂM B", realHcm: true },
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
    vehicle.lane = null;
    vehicle.stream = 100 + (slot % 2);
    vehicle.direction = slot % 2 === 0 ? 1 : -1;
    vehicle.phase = ((slot + 0.5) / corridorCount) * REAL_HCM_CORRIDOR.length;
    vehicle.speed =
      vehicle.kind === "car" ? 4.7 : vehicle.kind === "delivery" ? 5.2 : 5.8;
    vehicle.avoidOffset = 0;
  }
  return traffic;
}

/**
 * @param {any} vehicle
 * @param {number} time
 */
export function worldTrafficPose(vehicle, time) {
  if (vehicle.route !== REAL_HCM_CORRIDOR.id) {
    mapTrafficPose(vehicle, time);
    return;
  }
  const length = REAL_HCM_CORRIDOR.length;
  const travelled =
    (((vehicle.phase + time * vehicle.speed) % length) + length) % length;
  const routeDistance = vehicle.direction > 0 ? travelled : length - travelled;
  const pose = sampleRoute(routeDistance);
  const tx = vehicle.direction > 0 ? pose.tx : -pose.tx;
  const tz = vehicle.direction > 0 ? pose.tz : -pose.tz;
  const sideX = tz;
  const sideZ = -tx;
  const laneOffset = Math.min(1.25, REAL_HCM_CORRIDOR.width * 0.22);
  vehicle.x = pose.x + sideX * laneOffset;
  vehicle.z = pose.z + sideZ * laneOffset;
  vehicle.angle = Math.atan2(tx, tz);

  if (vehicle.honkedUntil > time && vehicle.honkedAt <= time) {
    const duration = Math.max(0.001, vehicle.honkedUntil - vehicle.honkedAt);
    const progress = clamp((time - vehicle.honkedAt) / duration, 0, 1);
    const nudge = Math.sin(progress * Math.PI) * 0.32;
    vehicle.x += sideX * nudge;
    vehicle.z += sideZ * nudge;
  }
}
