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

const changed = [];

if (
  await patchFile("src/game/Run.js", [
    [
      `import {\n  AVENUES,\n  surface,\n  collisionSurface,\n  makeTraffic,\n  trafficPose,\n  hiddenLaneAt,\n  vehicleClearance,\n} from "../world/map.js";`,
      `import { AVENUES, surface, hiddenLaneAt, vehicleClearance } from "../world/map.js";\nimport {\n  makeWorldTraffic,\n  worldCollisionSurface,\n  worldTrafficPose,\n} from "../world/HcmCorridor.js";`,
    ],
    ["this.traffic = makeTraffic(", "this.traffic = makeWorldTraffic("],
    ["trafficPose(v, 0);", "worldTrafficPose(v, 0);"],
    [
      `if (collisionSurface(nx, nz, CONFIG.radius) !== "wall") {`,
      `if (worldCollisionSurface(nx, nz, CONFIG.radius) !== "wall") {`,
    ],
    [
      `if (collisionSurface(nx, p.z, CONFIG.radius) !== "wall") p.x = nx;`,
      `if (worldCollisionSurface(nx, p.z, CONFIG.radius) !== "wall") p.x = nx;`,
    ],
    [
      `if (collisionSurface(p.x, nz, CONFIG.radius) !== "wall") p.z = nz;`,
      `if (worldCollisionSurface(p.x, nz, CONFIG.radius) !== "wall") p.z = nz;`,
    ],
    ["trafficPose(v, this.time);", "worldTrafficPose(v, this.time);"],
  ])
)
  changed.push("src/game/Run.js");

if (
  await patchFile("src/game/Missions.js", [
    [
      `import { STOPS } from "../world/map.js";`,
      `import { WORLD_STOPS as STOPS } from "../world/HcmCorridor.js";`,
    ],
    [
      `      passenger: i === 0 ? 0 : Math.floor(rng() * PASSENGERS.length),\n      // First trip exposes the authored shortcut; later trips use the full district.\n      destination: i === 0 ? 4 : (i + 1) % STOPS.length,`,
      `      passenger: i <= 1 ? 0 : Math.floor(rng() * PASSENGERS.length),\n      // Trip one proves the authored hẻm. Trip two deliberately moves into the\n      // playable OpenStreetMap corridor before later trips resume the full pool.\n      pickup: i === 1 ? STOPS.length - 2 : null,\n      destination:\n        i === 0 ? 4 : i === 1 ? STOPS.length - 1 : (i + 1) % STOPS.length,`,
    ],
    [
      `      this.pickup = STOPS[(next.destination + 4) % STOPS.length];\n      if (this.pickup === previous)\n        this.pickup = STOPS[(next.destination + 3) % STOPS.length];`,
      `      this.pickup =\n        next.pickup == null\n          ? STOPS[(next.destination + 4) % STOPS.length]\n          : STOPS[next.pickup];\n      if (this.pickup === previous && next.pickup == null)\n        this.pickup = STOPS[(next.destination + 3) % STOPS.length];`,
    ],
  ])
)
  changed.push("src/game/Missions.js");

if (
  await patchFile("src/main.js", [
    [
      `import { addRealHcmContext } from "./view/OsmContext.js";`,
      `import { addRealHcmContext } from "./view/OsmContext.js";\nimport { addPlayableHcmCorridor } from "./view/HcmCorridorView.js";`,
    ],
    [
      `import { trafficPose } from "./world/map.js";`,
      `import { worldTrafficPose } from "./world/HcmCorridor.js";`,
    ],
    [
      `  addRealHcmContext(view);`,
      `  addRealHcmContext(view);\n  addPlayableHcmCorridor(view);`,
    ],
    ["trafficPose(vehicle, menuTime);", "worldTrafficPose(vehicle, menuTime);"],
  ])
)
  changed.push("src/main.js");

if (
  await patchFile("scripts/core-driving-smoke.mjs", [
    [
      `import { openingRoutes } from "./evaluate-routes.mjs";`,
      `import { openingRoutes } from "./evaluate-routes.mjs";\nimport { REAL_HCM_CORRIDOR_STOPS } from "../src/world/HcmCorridor.js";`,
    ],
    [
      `  await page.screenshot({ path: \`${output}/after-route.png\` });`,
      `  await page.screenshot({ path: \`${output}/after-route.png\` });\n\n  const corridorEvidence = await page.evaluate((stops) => {\n    const start = stops[0];\n    const end = stops[1];\n    const p = window.xeom.run.player;\n    p.x = start.x;\n    p.z = start.z;\n    p.speed = 0;\n    p.vx = 0;\n    p.vz = 0;\n    p.angle = Math.atan2(end.x - start.x, end.z - start.z);\n    window.xeom.run.missions.phase = "dropoff";\n    window.xeom.run.missions.destination = end;\n    return {\n      start,\n      end,\n      corridorStats: window.xeom.view.realHcmCorridorStats,\n      corridorTraffic: window.xeom.run.traffic.filter(\n        (vehicle) => vehicle.route === "hcm-osm-corridor-1",\n      ).length,\n    };\n  }, REAL_HCM_CORRIDOR_STOPS);\n  report.corridor = corridorEvidence;\n  check(\n    "playable HCMC OSM corridor is rendered with real source geometry",\n    corridorEvidence.corridorStats?.source === "OpenStreetMap" &&\n      corridorEvidence.corridorStats.gameLength > 20,\n  );\n  check(\n    "live traffic is assigned to the HCMC OSM corridor",\n    corridorEvidence.corridorTraffic >= 2,\n  );\n  await page.waitForTimeout(250);\n  await page.screenshot({ path: \`${output}/hcm-corridor.png\` });`,
    ],
  ])
)
  changed.push("scripts/core-driving-smoke.mjs");

console.log(changed.length ? `Patched ${changed.join(", ")}` : "Playable HCMC corridor already integrated");
