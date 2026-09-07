import { readFile, writeFile } from "node:fs/promises";

const path = "src/world/HcmCorridor.js";
let source = await readFile(path, "utf8");
const startMarker = "function interpolateSourceRoute(start, end, steps = 7) {";
const endMarker = "export const REAL_HCM_CORRIDOR = Object.freeze(selectCorridor());";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);
if (start < 0 || end < 0 || end <= start) {
  throw new Error("Could not locate the temporary straight-line HCMC corridor block");
}

const replacement = String.raw`const DRIVABLE_TYPES = new Set([
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

function findOsmRoadPath(startAnchor, endAnchor) {
  const graph = buildRoadGraph(startAnchor, endAnchor);
  const startSnap = nearestRoadNode(graph, startAnchor);
  const endSnap = nearestRoadNode(graph, endAnchor);
  const queue = new MinHeap();
  const distances = new Map([[startSnap.key, 0]]);
  const previous = new Map();
  queue.push({ key: startSnap.key, priority: 0 });

  while (queue.items.length) {
    const current = queue.pop();
    if (!current) break;
    const currentDistance = distances.get(current.key);
    if (currentDistance === undefined || current.priority > currentDistance + 1e-6)
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
    throw new Error("Could not connect Bến Thành to Nguyễn Huệ on the committed OSM road graph");
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
  return { points, edges, startSnap, endSnap };
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
  const path = findOsmRoadPath(requestedStart, requestedEnd);
  const sourcePoints = simplifySourceRoute(path.points);
  const transformed = transformRoute(sourcePoints);
  const gamePoints = transformed.points;
  const sourceLength = polylineLength(sourcePoints);
  const gameLength = polylineLength(
    gamePoints.map((point) => [point.x, point.z]),
  );
  const sourceWidth = Math.max(
    6,
    ...path.edges.map((edge) => Number(edge.width) || 0),
  );
  const typeCounts = new Map();
  for (const edge of path.edges)
    typeCounts.set(edge.type, (typeCounts.get(edge.type) ?? 0) + 1);
  const sourceType =
    [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "secondary";
  const width = clamp(sourceWidth * PLAY_SCALE, 4.8, 6.4);
  return {
    id: "hcm-osm-corridor-1",
    name: SAIGON_VERTICAL_SLICE.name,
    source: "OpenStreetMap",
    sourceGeneratedAt: HCMC_OSM_DATA.generatedAt,
    sourceType,
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
    sourcePointCount: path.points.length,
    sourceSnapStartMetres: path.startSnap.distance,
    sourceSnapEndMetres: path.endSnap.distance,
    georeferencedTo: SAIGON_VERTICAL_SLICE.id,
    realWorldStart: SAIGON_VERTICAL_SLICE.start,
    realWorldEnd: SAIGON_VERTICAL_SLICE.end,
  };
}

`;

source =
  source.slice(0, start) +
  replacement +
  endMarker +
  source.slice(end + endMarker.length);
await writeFile(path, source);
console.log("Replaced straight georeference with an actual committed OSM road-graph path.");
