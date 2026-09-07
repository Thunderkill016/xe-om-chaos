import { writeFile } from "node:fs/promises";

const SOUTH = 10.768;
const WEST = 106.693;
const NORTH = 10.79;
const EAST = 106.716;
const TILE_ROWS = 3;
const TILE_COLS = 3;
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const METERS_PER_DEG_LAT = 111_320;
const CENTER_LAT = (SOUTH + NORTH) * 0.5;
const CENTER_LON = (WEST + EAST) * 0.5;
const METERS_PER_DEG_LON =
  METERS_PER_DEG_LAT * Math.cos((CENTER_LAT * Math.PI) / 180);
const ROAD_WIDTH = {
  motorway: 18,
  trunk: 16,
  primary: 13,
  secondary: 11,
  tertiary: 9,
  residential: 6.5,
  service: 4.5,
  living_street: 5,
  pedestrian: 5,
  footway: 2,
  path: 1.5,
  cycleway: 2.2,
  unclassified: 6,
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseNum = (value) => {
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};
const project = (lat, lon) => [
  (lon - CENTER_LON) * METERS_PER_DEG_LON,
  (lat - CENTER_LAT) * METERS_PER_DEG_LAT,
];
function hashNumber(value) {
  let h = 2166136261;
  for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
function buildingHeight(tags, id) {
  const h = parseNum(tags.height);
  if (h && h >= 2 && h <= 500) return h;
  const levels = parseNum(tags["building:levels"]);
  if (levels && levels >= 1 && levels <= 120) return levels * 3.25;
  const kind = tags.building || "";
  const r = hashNumber(id);
  if (["apartments", "hotel", "office", "commercial"].includes(kind))
    return [16, 20, 24, 30, 40, 55][Math.min(5, Math.floor(r * 6))];
  if (["retail", "supermarket"].includes(kind)) return 5 + r * 7;
  return [7, 10, 13, 16, 20, 26][Math.min(5, Math.floor(r * 6))];
}
function roadWidth(tags) {
  const width = parseNum(tags.width);
  if (width && width >= 1 && width <= 40) return width;
  const type = tags.highway || "residential";
  const lanes = parseNum(tags.lanes);
  let base = ROAD_WIDTH[type] ?? 5.5;
  if (lanes && lanes >= 2) base = Math.max(base, lanes * 3.2);
  return base;
}
function queryFor(south, west, north, east) {
  const bbox = `${south},${west},${north},${east}`;
  return `[out:json][timeout:25];(way["building"](${bbox});way["highway"](${bbox});way["waterway"](${bbox});way["natural"="water"](${bbox});way["leisure"="park"](${bbox});way["landuse"="grass"](${bbox});way["landuse"="recreation_ground"](${bbox}););out body;>;out skel qt;`;
}
async function fetchTile(south, west, north, east, index, total) {
  const body = new URLSearchParams({ data: queryFor(south, west, north, east) });
  let lastError;
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35_000);
      try {
        console.log(`[OSM ${index}/${total}] ${endpoint} attempt ${attempt}`);
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
            "user-agent": "Xe-Om-Chaos-HCMC-Generator/1.1",
            accept: "application/json",
          },
          body,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const data = await response.json();
        clearTimeout(timeout);
        console.log(`[OSM ${index}/${total}] OK ${data.elements?.length ?? 0} elements`);
        return data;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        console.warn(`[OSM ${index}/${total}] failed`, error?.message || error);
        await sleep(attempt === 1 ? 1800 : 2800);
      }
    }
  }
  throw new Error(`Could not fetch tile ${index}/${total}: ${lastError?.message || lastError}`);
}
async function fetchOsm() {
  const latStep = (NORTH - SOUTH) / TILE_ROWS;
  const lonStep = (EAST - WEST) / TILE_COLS;
  const total = TILE_ROWS * TILE_COLS;
  const merged = new Map();
  let index = 0;
  // Deliberately serial. Overpass rate-limits bursty tile requests; the Blender
  // source also downloads tile-by-tile for reliability.
  for (let row = 0; row < TILE_ROWS; row++) {
    for (let col = 0; col < TILE_COLS; col++) {
      index++;
      const data = await fetchTile(
        SOUTH + row * latStep,
        WEST + col * lonStep,
        SOUTH + (row + 1) * latStep,
        WEST + (col + 1) * lonStep,
        index,
        total,
      );
      for (const element of data.elements || [])
        merged.set(`${element.type}:${element.id}`, element);
      if (index < total) await sleep(900);
    }
  }
  return [...merged.values()];
}
function wayPoints(way, nodes) {
  const points = [];
  for (const id of way.nodes || []) {
    const node = nodes.get(id);
    if (node) points.push(project(node.lat, node.lon));
  }
  if (points.length > 1) {
    const a = points[0];
    const b = points.at(-1);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05) points.pop();
  }
  return points;
}
function orientedBounds(points) {
  if (points.length < 3) return null;
  let longest = 0;
  let angle = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len > longest) {
      longest = len;
      angle = Math.atan2(dx, dz);
    }
  }
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const [x, z] of points) {
    const rx = x * c - z * s;
    const rz = x * s + z * c;
    minX = Math.min(minX, rx);
    maxX = Math.max(maxX, rx);
    minZ = Math.min(minZ, rz);
    maxZ = Math.max(maxZ, rz);
  }
  const rcx = (minX + maxX) * 0.5;
  const rcz = (minZ + maxZ) * 0.5;
  const cc = Math.cos(angle);
  const ss = Math.sin(angle);
  return {
    x: rcx * cc - rcz * ss,
    z: rcx * ss + rcz * cc,
    w: maxX - minX,
    d: maxZ - minZ,
    angle,
  };
}
const round = (value, digits = 1) => Number(value.toFixed(digits));
function simplify(points, max = 22) {
  if (points.length <= max) return points.map(([x, z]) => [round(x), round(z)]);
  const result = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) {
    const point = points[Math.round(i * step)];
    result.push([round(point[0]), round(point[1])]);
  }
  return result;
}
function buildData(elements) {
  const nodes = new Map();
  const ways = [];
  for (const element of elements) {
    if (element.type === "node") nodes.set(element.id, element);
    else if (element.type === "way") ways.push(element);
  }
  const buildings = [];
  const roads = [];
  const water = [];
  const green = [];
  for (const way of ways) {
    const tags = way.tags || {};
    const points = wayPoints(way, nodes);
    if (points.length < 2) continue;
    if (tags.building && points.length >= 3) {
      const bounds = orientedBounds(points);
      if (!bounds || bounds.w * bounds.d < 28 || bounds.w > 170 || bounds.d > 170) continue;
      const h = buildingHeight(tags, way.id);
      buildings.push([
        round(bounds.x),
        round(bounds.z),
        round(bounds.w),
        round(bounds.d),
        round(h),
        round(bounds.angle, 3),
        tags.building || "yes",
      ]);
    } else if (tags.highway) {
      if (tags.highway === "steps") continue;
      roads.push([tags.highway, round(roadWidth(tags)), simplify(points, 28)]);
    } else if (tags.natural === "water" || tags.waterway) {
      water.push([tags.waterway ? "line" : "area", simplify(points, 30)]);
    } else if (
      tags.leisure === "park" ||
      ["grass", "recreation_ground"].includes(tags.landuse)
    ) {
      green.push(simplify(points, 28));
    }
  }
  buildings.sort(
    (a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]),
  );
  return {
    generatedAt: new Date().toISOString(),
    bounds: { south: SOUTH, west: WEST, north: NORTH, east: EAST },
    center: { lat: CENTER_LAT, lon: CENTER_LON },
    buildings: buildings.slice(0, 950),
    roads: roads.slice(0, 520),
    water: water.slice(0, 80),
    green: green.slice(0, 120),
  };
}

const elements = await fetchOsm();
const data = buildData(elements);
const output = `// Generated from OpenStreetMap by scripts/generate-hcm-osm.mjs.\n// Data attribution: © OpenStreetMap contributors (ODbL).\nexport const HCMC_OSM_DATA = ${JSON.stringify(data)};\n`;
await writeFile("src/world/hcm-downtown-data.js", output);
console.log(
  `Generated ${data.buildings.length} buildings, ${data.roads.length} roads, ${data.water.length} water features, ${data.green.length} green areas`,
);
