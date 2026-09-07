import { readFile, writeFile } from "node:fs/promises";

async function patchFile(path, replacements) {
  let content = await readFile(path, "utf8");
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(to)) continue;
    if (!content.includes(from))
      throw new Error(`Patch target not found in ${path}: ${from.slice(0, 100)}`);
    content = content.replace(from, to);
    changed = true;
  }
  if (changed) await writeFile(path, content);
  return changed;
}

const changed = await patchFile("src/world/HcmCorridor.js", [
  [
    `} from "./map.js";\n\nconst ANCHOR`,
    `} from "./map.js";\n\n/** @typedef {[number, number]} OsmPoint */\n/** @typedef {[string, number, OsmPoint[]]} OsmRoad */\n/** @typedef {[number, number, number, number, number, number, string]} OsmBuilding */\n/** @typedef {{x:number,z:number,w:number,d:number,h:number,angle:number,kind:string}} CorridorBuilding */\n\nconst ANCHOR`,
  ],
  [
    `function selectCorridor() {\n  const roads = HCMC_OSM_DATA.roads.filter(`,
    `function selectCorridor() {\n  /** @type {OsmRoad[]} */\n  const osmRoads = /** @type {OsmRoad[]} */ (HCMC_OSM_DATA.roads);\n  const roads = osmRoads.filter(`,
  ],
  [
    `  const buildings = [];\n  for (const source of HCMC_OSM_DATA.buildings) {`,
    `  /** @type {CorridorBuilding[]} */\n  const buildings = [];\n  /** @type {OsmBuilding[]} */\n  const osmBuildings = /** @type {OsmBuilding[]} */ (HCMC_OSM_DATA.buildings);\n  for (const source of osmBuildings) {`,
  ],
  [
    `    const vehicle = traffic[id];`,
    `    /** @type {any} */\n    const vehicle = traffic[id];`,
  ],
  [
    `export function worldTrafficPose(vehicle, time) {`,
    `/**\n * @param {any} vehicle\n * @param {number} time\n */\nexport function worldTrafficPose(vehicle, time) {`,
  ],
]);

console.log(changed ? "Typed playable HCMC corridor" : "Playable HCMC corridor types already applied");
