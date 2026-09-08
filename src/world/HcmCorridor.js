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
    lat: 10.77211,
    lon: 106.69827,
  }),
  end: Object.freeze({
    name: "LÊ LỢI · NGUYỄN HUỆ",
    lat: 10.77547,
    lon: 106.702148,
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

const DRIVABLE_TYPES = new Set([
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "living_street",
  "unclassified",
  "service",
]);
const ROAD_COST = Object.freeze({
  trunk: 0.9,
  primary: 0.88,
  secondary: 0.92,
  tertiary: 1,
  residential: 1.22,
  living_street: 1.35,
  unclassified: 1.18,
  service: 1.55,
});

function sourceNodeKey(point) {
  return point[0].toFixed(1) + "," + point[1].toFixed(1);
}

function addGraphEdge(graph, from, to, type, width, directStart, directEnd) {
  const fromKey = sourceNodeKey(from);
  const toKey = sourceNodeKey(to);
  if (fromKey === toKey) return;
  if (!graph.has(fromKey)) graph.set(fromKey, { point: from, edges: [] });
  if (!graph.has(toKey)) graph.set(toKey, { point: to, edges: [] });
  const midpoint = [(from[0] + to[0]) * 0.5, (from[1] + to[1]) * 0.5];
  const corridorDeviation = distanceToSegment(midpoint, directStart, directEnd);
  const deviationPenalty = 1 + Math.min(1.2, corridorDeviation / 260) * 0.32;
  const cost =
    segmentLength(from, to) * (ROAD_COST[type] ?? 1.35) * deviationPenalty;
  graph.get(fromKey).edges.push({ to: toKey, cost, type, width });
  graph.get(toKey).edges.push({ to: fromKey, cost, type, width });
}

function buildRoadGraph(startAnchor, endAnchor) {
  /** @type {OsmRoad[]} */
  const roads = /** @type {OsmRoad[]} */ (HCMC_OSM_DATA.roads);
  const graph = new Map();
  for (const [type, width, points] of roads) {
    if (!DRIVABLE_TYPES.has(type) || !points || points.length < 2) continue;
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1];
      const b = points[index];
      if (segmentLength(a, b) < 0.25) continue;
      addGraphEdge(graph, a, b, type, width, startAnchor, endAnchor);
    }
  }
  return graph;
}

function nearestRoadNode(graph, anchor) {
  let bestKey = null;
  let bestDistance = Infinity;
  for (const [key, node] of graph) {
    const distance = pointDistance(node.point, anchor);
    if (distance < bestDistance) {
      bestKey = key;
      bestDistance = distance;
    }
  }
  if (!bestKey) throw new Error("HCMC OSM road graph is empty");
  return { key: bestKey, distance: bestDistance };
}

class MinHeap {
  constructor() {
    this.items = [];
  }
  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority <= item.priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  pop() {
    if (!this.items.length) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length && last) {
      let index = 0;
      while (true) {
        let child = index * 2 + 1;
        if (child >= this.items.length) break;
        if (
          child + 1 < this.items.length &&
          this.items[child + 1].priority < this.items[child].priority
        )
          child++;
        if (this.items[child].priority >= last.priority) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

function connectedRoadSnaps(graph, startAnchor, endAnchor) {
  const visited = new Set();
  let best = null;
  for (const rootKey of graph.keys()) {
    if (visited.has(rootKey)) continue;
    const stack = [rootKey];
    visited.add(rootKey);
    let startSnap = { key: rootKey, distance: Infinity };
    let endSnap = { key: rootKey, distance: Infinity };
    let size = 0;
    while (stack.length) {
      const key = stack.pop();
      const node = graph.get(key);
      size++;
      const startDistance = pointDistance(node.point, startAnchor);
      if (startDistance < startSnap.distance)
        startSnap = { key, distance: startDistance };
      const endDistance = pointDistance(node.point, endAnchor);
      if (endDistance < endSnap.distance)
        endSnap = { key, distance: endDistance };
      for (const edge of node.edges)
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          stack.push(edge.to);
        }
    }
    if (size < 8) continue;
    const maxSnap = Math.max(startSnap.distance, endSnap.distance);
    const score =
      startSnap.distance +
      endSnap.distance +
      maxSnap * 1.4 +
      (size < 30 ? 180 : 0);
    if (!best || score < best.score)
      best = { score, startSnap, endSnap, size, maxSnap };
  }
  if (!best)
    throw new Error("HCMC OSM road graph has no connected driveable component");
  return best;
}

function findOsmRoadPath(startAnchor, endAnchor) {
  const graph = buildRoadGraph(startAnchor, endAnchor);
  const connected = connectedRoadSnaps(graph, startAnchor, endAnchor);
  const startSnap = connected.startSnap;
  const endSnap = connected.endSnap;
  const queue = new MinHeap();
  const distances = new Map([[startSnap.key, 0]]);
  const previous = new Map();
  queue.push({ key: startSnap.key, priority: 0 });

  while (queue.items.length) {
    const current = queue.pop();
    if (!current) break;
    const currentDistance = distances.get(current.key);
    if (
      currentDistance === undefined ||
      current.priority > currentDistance + 1e-6
    )
      continue;
    if (current.key === endSnap.key) break;
    const node = graph.get(current.key);
    for (const edge of node.edges) {
      const candidate = currentDistance + edge.cost;
      if (candidate >= (distances.get(edge.to) ?? Infinity)) continue;
      distances.set(edge.to, candidate);
      previous.set(edge.to, { key: current.key, edge });
      queue.push({ key: edge.to, priority: candidate });
    }
  }

  if (!distances.has(endSnap.key)) {
    throw new Error(
      "Could not connect Bến Thành to Nguyễn Huệ on the committed OSM road graph",
    );
  }

  const keys = [];
  const edges = [];
  let cursor = endSnap.key;
  while (cursor !== startSnap.key) {
    keys.push(cursor);
    const step = previous.get(cursor);
    if (!step) throw new Error("Broken HCMC OSM path reconstruction");
    edges.push(step.edge);
    cursor = step.key;
  }
  keys.push(startSnap.key);
  keys.reverse();
  edges.reverse();
  const points = keys.map((key) => graph.get(key).point);
  return {
    points,
    edges,
    startSnap,
    endSnap,
    connectedComponentSize: connected.size,
  };
}

function simplifySourceRoute(points, tolerance = 0.5) {
  if (points.length <= 2) return points;
  const output = [points[0]];
  for (let index = 1; index < points.length - 1; index++) {
    const a = output.at(-1);
    const b = points[index];
    const c = points[index + 1];
    const distance = distanceToSegment(b, a, c);
    if (distance > tolerance || segmentLength(a, c) > 26) output.push(b);
  }
  output.push(points.at(-1));
  return output;
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
  const requestedStart = projectLatLon(
    SAIGON_VERTICAL_SLICE.start.lat,
    SAIGON_VERTICAL_SLICE.start.lon,
  );
  const requestedEnd = projectLatLon(
    SAIGON_VERTICAL_SLICE.end.lat,
    SAIGON_VERTICAL_SLICE.end.lon,
  );
  const found = findOsmRoadPath(requestedStart, requestedEnd);
  const simplified = simplifySourceRoute(found.points);
  const sourceLength = polylineLength(simplified);
  if (sourceLength < 100)
    throw new Error("Bến Thành -> Nguyễn Huệ OSM route is unexpectedly short");
  const transformed = transformRoute(simplified);
  const widths = found.edges
    .map((edge) => Number(edge.width))
    .filter(Number.isFinite);
  const sourceTypes = [...new Set(found.edges.map((edge) => edge.type))];
  const sourceType =
    sourceTypes.length === 1 ? sourceTypes[0] : sourceTypes.join("+");
  const widthSource = widths.length
    ? widths.reduce((sum, width) => sum + width, 0) / widths.length
    : 8;
  return {
    id: "hcm-osm-corridor-1",
    source: "OpenStreetMap",
    attribution: HCMC_OSM_DATA.attribution,
    sourceType,
    sourceLength,
    width: clamp(widthSource * PLAY_SCALE, 4.8, 6.4),
    shoulderWidth: clamp(widthSource * PLAY_SCALE + 4.2, 9.6, 12.4),
    points: transformed.points,
    sourceOrigin: transformed.sourceOrigin,
    sourceHeading: transformed.sourceHeading,
    transformCos: transformed.c,
    transformSin: transformed.s,
    gameLength: sourceLength * PLAY_SCALE,
    startSnapMeters: found.startSnap.distance,
    endSnapMeters: found.endSnap.distance,
    connectedComponentSize: found.connectedComponentSize,
  };
}

const corridor = selectCorridor();
export const REAL_HCM_CORRIDOR = Object.freeze({
  ...corridor,
  length: corridor.gameLength,
  points: Object.freeze(
    corridor.points.map((point) => Object.freeze({ ...point })),
  ),
});

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
  const corridorCount = Math.min(2, regularCount);
  const first = regularCount - corridorCount;
  for (let id = first; id < regularCount; id++) {
    /** @type {any} */
    const vehicle = traffic[id];
    const slot = id - first;
    vehicle.route = REAL_HCM_CORRIDOR.id;
    vehicle.axis = null;
    vehicle.road = null;
    vehicle.lane = slot % 2 === 0 ? -1 : 1;
    vehicle.kind =
      slot % 3 === 0 ? "car" : slot % 3 === 1 ? "bike" : "delivery";
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
    angle:
      Math.atan2(pose.tx, pose.tz) +
      (vehicle.corridorDirection < 0 ? Math.PI : 0),
  };
}

export function worldTrafficPose(vehicle, time) {
  if (vehicle.route === REAL_HCM_CORRIDOR.id) {
    const pose = corridorTrafficPose(vehicle);
    vehicle.x = pose.x;
    vehicle.z = pose.z;
    vehicle.angle = pose.angle;
    return pose;
  }
  return mapTrafficPose(vehicle, time);
}

export function stepWorldTraffic(vehicle, dt) {
  if (vehicle.route !== REAL_HCM_CORRIDOR.id) return;
  vehicle.corridorDistance += vehicle.speed * dt;
  if (vehicle.corridorDistance > REAL_HCM_CORRIDOR.length)
    vehicle.corridorDistance -= REAL_HCM_CORRIDOR.length;
}
