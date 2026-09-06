import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { Run, EMPTY_INPUT } from "../src/game/Run.js";
import { CONFIG, angleDelta } from "../src/game/config.js";
import { HIDDEN_LANES } from "../src/world/map.js";

// Diagnostic controller, not a model of human skill. Both paces use identical
// braking/turning rules and a 60 Hz observation rate; only cruise speed changes.
const DRIVER = Object.freeze({
  // Below the hẻm's 1.65m usable half-width, including the bike's collision radius.
  waypointRadius: 1,
  stopDistance: 4,
  slowDistance: 7,
  cornerSpeed: 5,
  brakeAngle: 0.55,
  // A 0.09-radian deadzone let the driver aim into a curb for a full minute.
  steerDeadzone: 0.03,
  hornEveryTicks: 45,
});
export const SEEDS = [
  "2026-09-06",
  "2026-09-07",
  "2026-09-08",
  "2026-09-09",
  "2026-09-10",
];

export function openingRoutes(run) {
  const pickup = { ...run.missions.pickup, stop: true };
  const destination = { ...run.missions.destination, stop: true };
  const lane = HIDDEN_LANES[0];
  const exit = lane.points.at(-1);
  // Retain support for the previous opening destination when freezing a baseline.
  const oldDestination = destination.x !== exit.x || destination.z !== exit.z;
  return {
    avenue: [
      pickup,
      { x: pickup.x, z: 0 },
      { x: oldDestination ? destination.x : exit.x, z: 0 },
      destination,
    ],
    crossStreet: [
      pickup,
      { x: pickup.x, z: -36 },
      { x: exit.x, z: -36 },
      ...(oldDestination ? [{ x: exit.x, z: destination.z }] : []),
      destination,
    ],
    hem26: [
      pickup,
      { x: pickup.x, z: lane.points[0].z },
      ...lane.points.slice(1, -1),
      ...(oldDestination
        ? [exit, { x: exit.x, z: 0 }, { x: exit.x, z: destination.z }]
        : []),
      destination,
    ],
  };
}

export function driveOpeningRoute(seed, routeName, cruiseSpeed = 10) {
  const run = new Run(seed);
  const route = openingRoutes(run)[routeName];
  if (!route) throw new Error("Unknown diagnostic route: " + routeName);
  const initialTraffic = JSON.stringify(run.traffic);
  let waypoint = 0,
    pickupTime = null,
    pickupDistance = 0,
    pickupCrashes = 0,
    brakingTicks = 0;
  while (!run.ended && run.stats.deliveries === 0) {
    const player = run.player,
      target = route[waypoint];
    const distance = Math.hypot(target.x - player.x, target.z - player.z);
    const delta = angleDelta(
      Math.atan2(target.x - player.x, target.z - player.z),
      player.angle,
    );
    if (
      (!target.stop && distance < DRIVER.waypointRadius) ||
      (waypoint === 0 && run.missions.phase === "dropoff")
    ) {
      waypoint++;
      if (waypoint === 1) {
        pickupTime = run.time;
        pickupDistance = run.stats.distance;
        pickupCrashes = run.stats.crashes;
      }
      continue;
    }
    const wanted =
      target.stop && distance < DRIVER.stopDistance
        ? 0
        : Math.abs(delta) > DRIVER.brakeAngle
          ? 0
          : distance < DRIVER.slowDistance
            ? DRIVER.cornerSpeed
            : cruiseSpeed;
    const input = {
      ...EMPTY_INPUT,
      throttle: player.speed < wanted,
      brake: player.speed > wanted,
      left: delta > DRIVER.steerDeadzone,
      right: delta < -DRIVER.steerDeadzone,
      horn: run.tick % DRIVER.hornEveryTicks === 0,
    };
    if (pickupTime !== null && input.brake) brakingTicks++;
    run.step(input);
  }
  return {
    run,
    initialTraffic,
    measurement: {
      seed,
      route: routeName,
      cruiseSpeed,
      completed: run.stats.deliveries === 1,
      pickupSeconds: pickupTime,
      rideSeconds: pickupTime === null ? null : run.time - pickupTime,
      rideMetres: run.stats.distance - pickupDistance,
      rideCrashes: run.stats.crashes - pickupCrashes,
      brakingSeconds: brakingTicks * CONFIG.step,
      fare: run.stats.money,
      nearMisses: run.stats.nearMisses,
      alleys: run.stats.alleys,
      discovered: [...run.discoveredLanes],
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const measurements = [];
  for (const cruiseSpeed of [10, 16])
    for (const seed of SEEDS) {
      let referenceTraffic;
      for (const name of Object.keys(openingRoutes(new Run(seed)))) {
        const result = driveOpeningRoute(seed, name, cruiseSpeed);
        if (
          referenceTraffic !== undefined &&
          result.initialTraffic !== referenceTraffic
        )
          throw new Error("Unmatched initial traffic");
        referenceTraffic = result.initialTraffic;
        measurements.push(result.measurement);
      }
    }
  const sources = {};
  for (const file of [
    "src/game/Run.js",
    "src/game/Missions.js",
    "src/game/ChaosDirector.js",
    "src/game/config.js",
    "src/world/map.js",
    "scripts/evaluate-routes.mjs",
  ])
    sources[file] = createHash("sha256")
      .update(await readFile(file))
      .digest("hex");
  const report = {
    version: CONFIG.version,
    measuredAt: new Date().toISOString(),
    sources,
    method:
      "Whole first trip from default spawn, inputs only; paired seed, initial traffic, passenger, weather schedule, driver rules and pace. No teleports, removed traffic, clock overrides or reward overrides. Scripted driving is not human experience evidence.",
    driver: DRIVER,
    routes: openingRoutes(new Run(SEEDS[0])),
    measurements,
  };
  const output = process.argv[2] || "output/route-evaluation.json";
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  for (const pace of [10, 16])
    for (const route of Object.keys(report.routes)) {
      const rows = measurements.filter(
        (m) => m.route === route && m.cruiseSpeed === pace,
      );
      const times = rows.map((m) => m.rideSeconds).sort((a, b) => a - b);
      console.log(
        JSON.stringify({
          pace,
          route,
          completed: rows.filter((m) => m.completed).length,
          medianSeconds: times[Math.floor(times.length / 2)],
          crashes: rows.reduce((n, m) => n + m.rideCrashes, 0),
        }),
      );
    }
  console.log("Report:", output);
}
