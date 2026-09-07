import * as THREE from "three";
import { HCMC_OSM_DATA } from "../world/hcm-downtown-data.js";
import { cityChunks } from "./batch.js";

// Real-world downtown context generated from the exact OSM bounds used by the
// Blender source: Bến Thành -> Nguyễn Huệ -> Ba Son -> Saigon River.
// The current gameplay graph remains authoritative inside the central reserve;
// real OSM massing takes over around it so the city can become authentic before
// we migrate traffic/collision onto the OSM road graph in a later gameplay pass.
const GAME_SCALE = 0.12;
const CORE_RESERVE = 76;
const ROAD_RESERVE = 68;
const MAX_BUILDINGS_LOW = 260;
const MAX_BUILDINGS_HIGH = 720;
const MAJOR = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
]);
const ROAD_COLOUR = {
  motorway: 0x30363a,
  trunk: 0x343a3d,
  primary: 0x383e41,
  secondary: 0x3d4346,
  tertiary: 0x444a4d,
  residential: 0x51565a,
  service: 0x585d60,
  living_street: 0x5d6264,
  pedestrian: 0x89887c,
  footway: 0x9b9788,
  path: 0x858b7d,
  cycleway: 0x727d73,
  unclassified: 0x565b5e,
};
const FACADE_LOW = [0xc9b18d, 0xc98870, 0xa4aa91, 0xd3c9ad, 0x879b9d];
const FACADE_HIGH = [0x526c76, 0x607b82, 0x6d8589, 0x71868c, 0x4b626c];

const scaled = (value) => value * GAME_SCALE;
const radius = (x, z) => Math.hypot(scaled(x), scaled(z));

function roadRibbon(view, parent, a, b, width, colour) {
  const ax = scaled(a[0]);
  const az = scaled(a[1]);
  const bx = scaled(b[0]);
  const bz = scaled(b[1]);
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  if (length < 0.25) return;
  const mesh = view.mesh(
    parent,
    colour,
    (ax + bx) * 0.5,
    0.045,
    (az + bz) * 0.5,
    Math.max(0.24, scaled(width)),
    0.06,
    length,
  );
  mesh.rotation.y = Math.atan2(dx, dz);
}

function areaBox(view, parent, points, colour, y = 0.025) {
  if (!points?.length) return;
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const [x, z] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const cx = scaled((minX + maxX) * 0.5);
  const cz = scaled((minZ + maxZ) * 0.5);
  const w = Math.max(0.8, scaled(maxX - minX));
  const d = Math.max(0.8, scaled(maxZ - minZ));
  view.mesh(parent, colour, cx, y, cz, w, 0.08, d);
}

export function addRealHcmContext(view) {
  const data = HCMC_OSM_DATA;
  if (!data.buildings.length && !data.roads.length) return null;

  const solid = new THREE.Group();
  solid.name = "HCMC_REAL_OSM_SOURCE";
  const quality = view.quality === "low" ? "low" : "high";
  const buildingLimit =
    quality === "low" ? MAX_BUILDINGS_LOW : MAX_BUILDINGS_HIGH;

  for (const feature of data.green)
    areaBox(view, solid, feature, 0x4b7157, 0.02);
  for (const [kind, points] of data.water) {
    if (kind === "area") areaBox(view, solid, points, 0x397c86, -0.02);
    else
      for (let i = 1; i < points.length; i++)
        roadRibbon(view, solid, points[i - 1], points[i], 13, 0x397c86);
  }

  for (const [type, width, points] of data.roads) {
    const major = MAJOR.has(type);
    const colour = ROAD_COLOUR[type] ?? ROAD_COLOUR.unclassified;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const mx = (a[0] + b[0]) * 0.5;
      const mz = (a[1] + b[1]) * 0.5;
      if (!major && radius(mx, mz) < ROAD_RESERVE) continue;
      roadRibbon(view, solid, a, b, width, colour);
    }
  }

  let made = 0;
  for (let i = 0; i < data.buildings.length && made < buildingLimit; i++) {
    const [mx, mz, mw, md, mh, angle, kind] = data.buildings[i];
    const x = scaled(mx);
    const z = scaled(mz);
    if (Math.hypot(x, z) < CORE_RESERVE) continue;
    const h = Math.max(1.6, scaled(mh));
    const w = Math.max(0.8, scaled(mw));
    const d = Math.max(0.8, scaled(md));
    if (w > 24 || d > 24) continue;
    const high =
      mh >= 38 ||
      ["office", "hotel", "commercial", "apartments"].includes(kind);
    const palette = high ? FACADE_HIGH : FACADE_LOW;
    const colour = palette[(i * 7 + Math.round(mh)) % palette.length];
    const mesh = view.mesh(solid, colour, x, h * 0.5, z, w, h, d);
    mesh.rotation.y = angle;
    if (high && h > 4.2 && i % 3 !== 0) {
      const glass = view.mesh(
        solid,
        i % 5 === 0 ? 0xd7ad66 : 0x7f9ea3,
        x,
        Math.min(h - 0.6, h * 0.58),
        z - Math.cos(angle) * (d * 0.51),
        Math.max(0.5, w * 0.56),
        Math.max(0.35, h * 0.045),
        0.06,
      );
      glass.rotation.y = angle;
    }
    made++;
  }

  const batch = cityChunks(solid);
  batch.name = "HCMC_REAL_OSM_CONTEXT";
  view.root.add(batch);
  view.realHcmContext = batch;
  view.realHcmStats = {
    generatedAt: data.generatedAt,
    buildings: made,
    roads: data.roads.length,
    bounds: data.bounds,
  };
  return batch;
}
