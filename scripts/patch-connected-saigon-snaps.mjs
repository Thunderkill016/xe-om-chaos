import { readFile, writeFile } from "node:fs/promises";

const path = "src/world/HcmCorridor.js";
let source = await readFile(path, "utf8");
const marker = `function findOsmRoadPath(startAnchor, endAnchor) {
  const graph = buildRoadGraph(startAnchor, endAnchor);
  const startSnap = nearestRoadNode(graph, startAnchor);
  const endSnap = nearestRoadNode(graph, endAnchor);`;
if (!source.includes(marker)) {
  console.log("Connected-snap patch already applied or source shape changed.");
  process.exit(0);
}

const helper = `function connectedRoadSnaps(graph, startAnchor, endAnchor) {
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

`;

source = source.replace(
  marker,
  `${helper}function findOsmRoadPath(startAnchor, endAnchor) {
  const graph = buildRoadGraph(startAnchor, endAnchor);
  const connected = connectedRoadSnaps(graph, startAnchor, endAnchor);
  const startSnap = connected.startSnap;
  const endSnap = connected.endSnap;`,
);
source = source.replace(
  `return { points, edges, startSnap, endSnap };`,
  `return {
    points,
    edges,
    startSnap,
    endSnap,
    connectedComponentSize: connected.size,
  };`,
);
source = source.replace(
  `sourceSnapEndMetres: path.endSnap.distance,`,
  `sourceSnapEndMetres: path.endSnap.distance,
    sourceConnectedComponentSize: path.connectedComponentSize,`,
);

await writeFile(path, source);
console.log("Snapped both Saigon anchors to one connected OSM road component.");
