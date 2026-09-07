import * as THREE from "three";
import { HCMC_OSM_DATA } from "../world/hcm-downtown-data.js";
import { REAL_HCM_CORRIDOR } from "../world/HcmCorridor.js";
import { cityChunks } from "./batch.js";

const CONTEXT_RADIUS = 108;
const BACKGROUND_BUILDING_MIN = 18;
const MAX_BUILDINGS_LOW = 120;
const MAX_BUILDINGS_HIGH = 260;
const MAJOR = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
]);
/** @type {Record<string, number>} */
const ROAD_COLOUR = {
  motorway: 0x2d3236,
  trunk: 0x32383b,
  primary: 0x383e42,
  secondary: 0x41474a,
  tertiary: 0x494f52,
  residential: 0x555a5d,
  service: 0x5d6265,
  living_street: 0x666967,
  pedestrian: 0x989382,
  footway: 0xa7a08e,
  path: 0x858c7e,
  cycleway: 0x737e74,
  unclassified: 0x5b6062,
};
const FACADE_LOW = [0xc5ae8b, 0xc4836d, 0xa0a68e, 0xd2c5a6, 0x869a9b];
const FACADE_HIGH = [0x526b75, 0x607981, 0x6d8589, 0x71868c, 0x4a616b];

/** @typedef {[number, number]} OsmPoint */
/** @typedef {[string, number, OsmPoint[]]} OsmRoad */
/** @typedef {[string, OsmPoint[]]} OsmWater */
/** @typedef {[number, number, number, number, number, number, string]} OsmBuilding */

function sourceToGame(x, z) {
  const dx = x - REAL_HCM_CORRIDOR.sourceOrigin[0];
  const dz = z - REAL_HCM_CORRIDOR.sourceOrigin[1];
  return {
    x:
      (dx * REAL_HCM_CORRIDOR.transformCos -
        dz * REAL_HCM_CORRIDOR.transformSin) *
      REAL_HCM_CORRIDOR.scale,
    z:
      72 +
      (dx * REAL_HCM_CORRIDOR.transformSin +
        dz * REAL_HCM_CORRIDOR.transformCos) *
        REAL_HCM_CORRIDOR.scale,
  };
}

function pointToSegmentDistance(x, z, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const denominator = dx * dx + dz * dz;
  if (denominator <= 1e-9) return Math.hypot(x - a.x, z - a.z);
  const t = Math.max(
    0,
    Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / denominator),
  );
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}

function corridorDistance(x, z) {
  let best = Infinity;
  for (let index = 1; index < REAL_HCM_CORRIDOR.points.length; index++)
    best = Math.min(
      best,
      pointToSegmentDistance(
        x,
        z,
        REAL_HCM_CORRIDOR.points[index - 1],
        REAL_HCM_CORRIDOR.points[index],
      ),
    );
  return best;
}

function roadRibbon(view, parent, a, b, width, colour, y = 0.035) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.25) return;
  const mesh = view.mesh(
    parent,
    colour,
    (a.x + b.x) * 0.5,
    y,
    (a.z + b.z) * 0.5,
    Math.max(0.28, width * REAL_HCM_CORRIDOR.scale),
    0.055,
    length,
  );
  mesh.rotation.y = Math.atan2(dx, dz);
}

function transformedBounds(points) {
  if (!points?.length) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [sx, sz] of points) {
    const point = sourceToGame(sx, sz);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  const x = (minX + maxX) * 0.5;
  const z = (minZ + maxZ) * 0.5;
  return { x, z, w: maxX - minX, d: maxZ - minZ };
}

function areaBox(view, parent, points, colour, y = 0.018) {
  const bounds = transformedBounds(points);
  if (!bounds) return;
  if (corridorDistance(bounds.x, bounds.z) > CONTEXT_RADIUS) return;
  if (bounds.w > 150 || bounds.d > 150) return;
  view.mesh(
    parent,
    colour,
    bounds.x,
    y,
    bounds.z,
    Math.max(0.8, bounds.w),
    0.055,
    Math.max(0.8, bounds.d),
  );
}

export function addRealHcmContext(view) {
  const data = HCMC_OSM_DATA;
  if (!data.buildings.length && !data.roads.length) return null;

  const waterFeatures = /** @type {OsmWater[]} */ (data.water);
  const greenFeatures = /** @type {OsmPoint[][]} */ (data.green);
  const roads = /** @type {OsmRoad[]} */ (data.roads);
  const buildings = /** @type {OsmBuilding[]} */ (data.buildings);

  const solid = new THREE.Group();
  solid.name = "HCMC_REAL_OSM_SOURCE";
  const quality = view.quality === "low" ? "low" : "high";
  const buildingLimit =
    quality === "low" ? MAX_BUILDINGS_LOW : MAX_BUILDINGS_HIGH;

  for (const feature of greenFeatures)
    areaBox(view, solid, feature, 0x4f7359, 0.012);
  for (const [kind, points] of waterFeatures) {
    if (kind === "area") areaBox(view, solid, points, 0x397b86, -0.015);
    else
      for (let index = 1; index < points.length; index++) {
        const a = sourceToGame(...points[index - 1]);
        const b = sourceToGame(...points[index]);
        const midpoint = { x: (a.x + b.x) * 0.5, z: (a.z + b.z) * 0.5 };
        if (corridorDistance(midpoint.x, midpoint.z) <= CONTEXT_RADIUS)
          roadRibbon(view, solid, a, b, 13, 0x397b86, -0.012);
      }
  }

  for (const [type, width, points] of roads) {
    const major = MAJOR.has(type);
    const colour = ROAD_COLOUR[type] ?? ROAD_COLOUR.unclassified;
    for (let index = 1; index < points.length; index++) {
      const a = sourceToGame(...points[index - 1]);
      const b = sourceToGame(...points[index]);
      const midpoint = { x: (a.x + b.x) * 0.5, z: (a.z + b.z) * 0.5 };
      const distance = corridorDistance(midpoint.x, midpoint.z);
      if (distance > CONTEXT_RADIUS) continue;
      if (!major && distance < REAL_HCM_CORRIDOR.shoulderWidth * 0.6) continue;
      roadRibbon(view, solid, a, b, width, colour);
    }
  }

  let made = 0;
  for (let index = 0; index < buildings.length && made < buildingLimit; index++) {
    const [sx, sz, sw, sd, sh, angle, kind] = buildings[index];
    const position = sourceToGame(sx, sz);
    const distance = corridorDistance(position.x, position.z);
    if (distance < BACKGROUND_BUILDING_MIN || distance > CONTEXT_RADIUS) continue;
    const w = Math.max(1.2, sw * REAL_HCM_CORRIDOR.scale);
    const d = Math.max(1.2, sd * REAL_HCM_CORRIDOR.scale);
    if (w > 30 || d > 30) continue;
    const h = Math.max(2.5, Math.min(42, sh * 0.22));
    const high =
      sh >= 38 ||
      ["office", "hotel", "commercial", "apartments"].includes(kind);
    const palette = high ? FACADE_HIGH : FACADE_LOW;
    const colour = palette[(index * 7 + Math.round(sh)) % palette.length];
    const group = new THREE.Group();
    group.position.set(position.x, 0, position.z);
    group.rotation.y = angle - REAL_HCM_CORRIDOR.sourceHeading;
    solid.add(group);
    view.mesh(group, colour, 0, h * 0.5, 0, w, h, d);
    view.mesh(
      group,
      high ? 0x465c63 : 0x776d5e,
      0,
      h + 0.12,
      0,
      Math.max(1, w * 0.88),
      0.24,
      Math.max(1, d * 0.88),
    );
    if (h > 6 && index % 2 === 0)
      for (let floor = 3.4; floor < h - 1; floor += 3.2)
        view.mesh(
          group,
          index % 5 === 0 ? 0xd6aa68 : 0x77979d,
          0,
          floor,
          -d * 0.505,
          Math.max(0.9, w * 0.58),
          0.5,
          0.06,
        );
    made++;
  }

  const batch = cityChunks(solid);
  batch.name = "HCMC_REAL_OSM_CONTEXT";
  view.root.add(batch);
  view.realHcmContext = batch;
  view.realHcmStats = {
    generatedAt: data.generatedAt,
    buildings: made,
    roads: roads.length,
    bounds: data.bounds,
    alignedTo: REAL_HCM_CORRIDOR.id,
  };
  return batch;
}
