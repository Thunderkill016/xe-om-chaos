import test from "node:test";
import assert from "node:assert/strict";
import { Run, EMPTY_INPUT } from "../src/game/Run.js";
import {
  CONFIG,
  dailySeed,
  validSeed,
  angleDelta,
} from "../src/game/config.js";
import {
  surface,
  STOPS,
  HIDDEN_LANES,
  hiddenLaneAt,
} from "../src/world/map.js";
import { CHAOS } from "../src/game/ChaosDirector.js";
import { PASSENGERS } from "../src/game/Missions.js";
import * as THREE from "three";
import {
  colouredGeometry,
  cityGeometry,
  vertexMaterial,
} from "../src/view/batch.js";
import { getMissionGuidance } from "../src/platform/UI.js";
import {
  driveOpeningRoute,
  openingRoutes,
  SEEDS,
} from "../scripts/evaluate-routes.mjs";

test("departure guidance waits for movement, not an expiring tutorial timer", () => {
  const run = new Run("guidance-start");
  run.time = CONFIG.runSeconds / 2;
  assert.equal(getMissionGuidance(run).stage, "depart");
  assert.match(getMissionGuidance(run).hint, /W \/ ↑/);
  assert.match(getMissionGuidance(run, "vi", true).hint, /NÚT GA/);
  assert.match(getMissionGuidance(run, "en", true).hint, /TOUCH/);
  run.stats.distance = CONFIG.stopRadius;
  assert.equal(getMissionGuidance(run).stage, "route");
});

test("boarding guidance matches the simulation's strict stop radius and speed", () => {
  const run = new Run("guidance-stop");
  const target = run.missions.target;
  run.player.x = target.x + CONFIG.stopRadius;
  run.player.z = target.z;
  assert.equal(getMissionGuidance(run).stage, "brake");
  assert.equal(getMissionGuidance(run).showProgress, false);
  Object.assign(run.player, target);
  for (const speed of [CONFIG.stopSpeed, -CONFIG.stopSpeed]) {
    run.player.speed = speed;
    assert.equal(getMissionGuidance(run).stage, "brake");
    assert.equal(getMissionGuidance(run).progress, 0);
  }
  run.player.speed = 0;
  run.missions.dwell = CONFIG.boardingSeconds / 2;
  const guidance = getMissionGuidance(run);
  assert.equal(guidance.stage, "boarding");
  assert.equal(guidance.showProgress, true);
  assert.equal(guidance.progress, 0.5);
  assert.match(guidance.hint, /LÊN XE/);
  assert.equal(getMissionGuidance(run, "en").progressLabel, "Pickup progress");
  run.player.z += CONFIG.stopRadius * 2;
  assert.equal(getMissionGuidance(run).showProgress, false);
  assert.equal(getMissionGuidance(run).progress, 0);
});

test("each passenger's bonus is visible before and during their trip", () => {
  const run = new Run("guidance-preferences");
  const vietnamese = [/ĐẾN SỚM/, /CHẠY ÊM/, /ĐI XUYÊN HẺM/, /LÁCH XE AN TOÀN/];
  const english = [
    /ARRIVE EARLY/,
    /RIDE SMOOTHLY/,
    /TAKE AN ALLEY/,
    /SAFE CLOSE PASSES/,
  ];
  for (const [index, passenger] of PASSENGERS.entries()) {
    run.missions.passenger = passenger;
    for (const phase of ["pickup", "dropoff"]) {
      run.missions.phase = phase;
      assert.match(getMissionGuidance(run).preference, vietnamese[index]);
      assert.match(getMissionGuidance(run, "en").preference, english[index]);
    }
  }
});

test("late trips remain deliverable and never show negative deadline seconds", () => {
  const run = new Run("guidance-late");
  run.missions.phase = "dropoff";
  run.missions.deadline = -CONFIG.step;
  run.stats.distance = CONFIG.stopRadius;
  assert.equal(getMissionGuidance(run).stage, "overdue");
  assert.equal(getMissionGuidance(run).deadline, "QUÁ GIỜ");
  assert.match(getMissionGuidance(run, "en").hint, /CAN STILL DROP OFF/);
  Object.assign(run.player, run.missions.target);
  assert.equal(getMissionGuidance(run).stage, "boarding");
  assert.match(getMissionGuidance(run).hint, /XUỐNG XE/);
  assert.equal(
    getMissionGuidance(run, "en").progressLabel,
    "Drop-off progress",
  );
  run.missions.deadline = 0;
  assert.equal(getMissionGuidance(run).deadline, "0 s");
  run.missions.phase = "pickup";
  assert.equal(getMissionGuidance(run).deadline, "");
});

test("recovery overrides riding advice and HUD queries cannot mutate the run", () => {
  const run = new Run("guidance-recovery");
  Object.assign(run.player, run.missions.target);
  run.player.recovery = CONFIG.recoverySeconds;
  const before = JSON.stringify(run);
  assert.equal(getMissionGuidance(run).stage, "recovery");
  assert.equal(getMissionGuidance(run).showProgress, false);
  getMissionGuidance(run, "en", true);
  assert.equal(JSON.stringify(run), before);
});

test("daily seed uses UTC and rejects impossible dates", () => {
  assert.equal(dailySeed(new Date("2026-09-06T00:30:00+07:00")), "2026-09-05");
  assert.ok(validSeed("2026-09-06"));
  assert.ok(!validSeed("2026-02-30"));
});
test("same seed and input tape reproduce state, traffic, missions and recording", () => {
  const a = new Run("2026-09-06"),
    b = new Run("2026-09-06");
  for (let i = 0; i < 1800; i++) {
    const input = {
      ...EMPTY_INPUT,
      throttle: i % 400 < 260,
      left: i % 600 > 420,
      horn: i % 70 === 0,
    };
    a.step(input);
    b.step(input);
  }
  assert.deepEqual(a.result(), b.result());
  assert.deepEqual(a.record, b.record);
  assert.deepEqual(a.traffic, b.traffic);
  assert.notDeepEqual(a.traffic, new Run("2026-09-07").traffic);
});
test("throttle responds in one fixed tick; braking stops; no NaNs", () => {
  const r = new Run("handling");
  r.traffic = [];
  r.step({ ...EMPTY_INPUT, throttle: true });
  assert.ok(r.player.speed > 0);
  assert.ok(r.player.z > -43);
  for (let i = 0; i < 60; i++) r.step({ ...EMPTY_INPUT, throttle: true });
  const speed = r.player.speed;
  for (let i = 0; i < 40; i++) r.step({ ...EMPTY_INPUT, brake: true });
  assert.ok(r.player.speed < speed);
  assert.equal(r.player.speed, 0);
  assert.ok(Number.isFinite(r.player.x));
});
test("pickup and dropoff require stopping and award actual fare exactly once", () => {
  const r = new Run("mission");
  r.traffic = [];
  Object.assign(r.player, STOPS[0], { speed: 15 });
  r.step({ ...EMPTY_INPUT, throttle: true });
  assert.equal(r.missions.phase, "pickup");
  Object.assign(r.player, STOPS[0], { speed: 0, vx: 0, vz: 0 });
  for (let i = 0; i < 25; i++) r.step();
  assert.equal(r.missions.phase, "dropoff");
  Object.assign(r.player, r.missions.destination, { speed: 0, vx: 0, vz: 0 });
  for (let i = 0; i < 25; i++) r.step();
  assert.equal(r.stats.deliveries, 1);
  assert.ok(r.stats.money > 16000);
  for (let i = 0; i < 50; i++) r.step();
  assert.equal(r.stats.deliveries, 1);
});
test("crash recovery is bounded and immunity prevents chain punishment", () => {
  const r = new Run("crash");
  r.traffic = [];
  r.player.immune = 0;
  r.crash();
  r.crash();
  assert.equal(r.stats.crashes, 1);
  for (let i = 0; i < 74; i++) r.step();
  assert.equal(r.player.recovery, 0);
  r.step({ ...EMPTY_INPUT, throttle: true });
  assert.ok(r.player.speed > 0);
  assert.equal(r.flow.combo, 1);
});
test("map supports boulevard and genuine alley shortcuts with collision boundary", () => {
  assert.equal(surface(0, 32), "road");
  assert.equal(surface(36, 20), "alley");
  assert.equal(surface(30, 20), "wall");
  assert.equal(surface(90, 0), "wall");
});
test("run ends at 180 simulation seconds and cannot keep scoring", () => {
  const r = new Run("end");
  r.traffic = [];
  for (let i = 0; i < 10800; i++) r.step();
  assert.equal(r.ended, true);
  assert.equal(r.time, 180);
  const result = r.result();
  r.step({ ...EMPTY_INPUT, throttle: true });
  assert.deepEqual(r.result(), result);
  assert.equal(r.record.inputs.length, 10800);
  assert.equal(r.record.poses.length, 1800);
});

function atEvent(id) {
  const run = new Run("chaos-fixture");
  run.traffic = [];
  const event = run.director.schedule.find((e) => e.id === id);
  run.tick = Math.ceil((event.start + 1) / CONFIG.step);
  run.time = run.tick * CONFIG.step;
  return run;
}
test("all six chaos events activate and emit observable schedule evidence", () => {
  for (const event of CHAOS) {
    const run = atEvent(event.id);
    run.step();
    assert.ok(run.director.active.has(event.id), event.id);
    assert.ok(
      run.record.events.some((e) => e.type === "chaos"),
      event.id,
    );
  }
});
test("rain lowers lateral grip, flood caps speed, rush adds real collision traffic", () => {
  const wet = atEvent("rain"),
    dry = new Run("dry");
  dry.traffic = [];
  for (const r of [wet, dry])
    Object.assign(r.player, {
      x: 0,
      z: 0,
      speed: 20,
      angle: Math.PI / 2,
      vx: 0,
      vz: 0,
    });
  wet.step({ ...EMPTY_INPUT, throttle: true });
  dry.step({ ...EMPTY_INPUT, throttle: true });
  assert.ok(wet.player.vx < dry.player.vx);
  const flooded = atEvent("flood");
  Object.assign(flooded.player, { x: 72, z: 35, speed: 24 });
  flooded.step({ ...EMPTY_INPUT, throttle: true });
  assert.ok(flooded.player.speed < 11);
  const rush = new Run("rush");
  rush.tick = Math.ceil(
    (rush.director.schedule.find((e) => e.id === "rush").start + 1) /
      CONFIG.step,
  );
  rush.step();
  assert.equal(
    rush.traffic.filter((v) => v.active).length,
    CONFIG.trafficCount + CONFIG.rushCount,
  );
});
test("pothole causes a bounded bounce and speed penalty", () => {
  const r = atEvent("potholes");
  Object.assign(r.player, { x: 2, z: 20, speed: 20 });
  r.step({ ...EMPTY_INPUT, throttle: true });
  assert.ok(r.player.bounce > 0);
  assert.ok(r.player.speed < 15);
  assert.ok(r.moments.some((m) => m.type === "airtime"));
});
test("barrier never spawns under rider; collision has a route around it", () => {
  const r = atEvent("block");
  Object.assign(r.player, { x: 0, z: 36 });
  r.step();
  assert.equal(r.director.barrier.active, false);
  Object.assign(r.player, { x: 0, z: 20 });
  r.step();
  assert.equal(r.director.barrier.active, true);
  Object.assign(r.player, { x: 0, z: 36, speed: 15, immune: 0 });
  r.step();
  assert.equal(r.stats.crashes, 1);
  assert.ok(Math.abs(r.player.z - 36) > 1.25);
  assert.equal(surface(6, 36), "road");
});
test("bus moves across intersection and collision recovers without ending run", () => {
  const r = atEvent("bus");
  r.step();
  const x = r.director.bus.x;
  for (let i = 0; i < 60; i++) r.step();
  assert.ok(r.director.bus.x > x);
  Object.assign(r.player, { x: r.director.bus.x, z: 0, speed: 15, immune: 0 });
  r.step();
  assert.equal(r.stats.crashes, 1);
  assert.equal(r.ended, false);
});
test("close encounter scores only after safe exit; collision cannot score a near miss", () => {
  const r = new Run("near");
  const v = r.traffic[0];
  r.traffic = [v];
  v.left = 0;
  v.top = 0;
  v.direction = 1;
  v.phase = 25;
  v.speed = 0;
  v.kind = "bike";
  v.radius = 0.72;
  Object.assign(r.player, { x: 25, z: 5, speed: 12, angle: 0, immune: 0 });
  r.step({ ...EMPTY_INPUT, throttle: true });
  assert.ok(v.near);
  Object.assign(r.player, { x: 31, z: 5, speed: 12 });
  r.step({ ...EMPTY_INPUT, throttle: true });
  assert.equal(r.stats.nearMisses, 1);
  for (let i = 0; i < 3; i++) {
    Object.assign(r.player, { x: 25, z: 5, speed: 12 });
    r.step({ ...EMPTY_INPUT, throttle: true });
    Object.assign(r.player, { x: 31, z: 5, speed: 12 });
    r.step({ ...EMPTY_INPUT, throttle: true });
  }
  assert.equal(r.stats.nearMisses, 1);
  v.lastNear = -100;
  Object.assign(r.player, {
    x: v.x,
    z: v.z,
    speed: 12,
    vx: 0,
    vz: 0,
    immune: 0,
  });
  r.step({ ...EMPTY_INPUT, throttle: true });
  assert.equal(r.stats.crashes, 1);
  assert.equal(r.stats.nearMisses, 1);
});
test("horn response is input driven, bounded and deterministic", () => {
  const r = new Run("horn");
  Object.assign(r.player, { x: r.traffic[0].x, z: r.traffic[0].z });
  r.step({ ...EMPTY_INPUT, horn: true });
  assert.equal(r.stats.horns, 1);
  assert.ok(r.traffic[0].honkedUntil > r.time);
  for (let i = 0; i < 10; i++) r.step({ ...EMPTY_INPUT, horn: true });
  assert.equal(r.stats.horns, 1);
  assert.ok(r.record.events.some((e) => e.type === "reply"));
});
test("alley traversal rewards crossing, not dipping into the same entrance", () => {
  const r = new Run("alley");
  r.traffic = [];
  r.player.immune = 0;
  Object.assign(r.player, { x: 36, z: 8 });
  r.step();
  Object.assign(r.player, { x: 36, z: 4 });
  r.step();
  assert.equal(r.stats.alleys, 0);
  Object.assign(r.player, { x: 36, z: 8 });
  r.step();
  Object.assign(r.player, { x: 36, z: 31 });
  r.step();
  Object.assign(r.player, { x: 36, z: 71 });
  r.step();
  assert.equal(r.stats.alleys, 1);
  assert.ok(r.stats.style > 0);
});

test("the opening hẻm earns a real delivery from default spawn using inputs only", () => {
  const { run, measurement } = driveOpeningRoute("2026-09-06", "hem26");
  assert.equal(run.stats.deliveries, 1);
  assert.equal(run.stats.crashes, 0);
  assert.ok(run.discoveredLanes.has("hem26"));
  assert.ok(run.stats.alleys > 0);
  assert.ok(run.time < 25);
  assert.ok(measurement.rideMetres > 40);
  assert.ok(run.stats.money > 15000);
  assert.equal(run.record.inputs.length, run.tick);
  const replay = new Run(run.seed);
  for (const mask of run.record.inputs)
    replay.step({
      throttle: Boolean(mask & 1),
      brake: Boolean(mask & 2),
      left: Boolean(mask & 4),
      right: Boolean(mask & 8),
      boost: Boolean(mask & 16),
      horn: Boolean(mask & 32),
    });
  assert.deepEqual(replay.stats, run.stats);
  assert.deepEqual(replay.record.events, run.record.events);
});

test("the first request makes Hẻm 26 a useful choice against both existing approaches", () => {
  const times = { avenue: [], crossStreet: [], hem26: [] };
  for (const seed of SEEDS) {
    let initialTraffic;
    for (const route of Object.keys(times)) {
      const result = driveOpeningRoute(seed, route);
      initialTraffic ??= result.initialTraffic;
      assert.equal(result.initialTraffic, initialTraffic);
      assert.equal(result.measurement.completed, true);
      times[route].push(result.measurement.rideSeconds);
    }
  }
  const median = (values) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  assert.ok(median(times.hem26) < median(times.avenue));
  assert.ok(median(times.hem26) < median(times.crossStreet));
  const routes = openingRoutes(new Run(SEEDS[0]));
  assert.ok(routes.hem26[0].z < HIDDEN_LANES[0].points[0].z);
  assert.deepEqual(routes.hem26.at(-1), { ...STOPS[4], stop: true });
});

test("an alley dropoff earns the student's bonus before fare settlement, only once", () => {
  const run = new Run("student-dropoff");
  run.traffic = [];
  run.player.immune = 0;
  run.missions.phase = "dropoff";
  run.missions.passenger = PASSENGERS[2];
  run.missions.deadline = 20;
  run.missions.destination = { x: 36, z: 28, name: "ALLEY STOP" };
  Object.assign(run.player, { x: 36, z: 8 });
  run.step();
  Object.assign(run.player, { x: 36, z: 28 });
  for (let i = 0; i < 25; i++) run.step();
  assert.equal(run.stats.alleys, 1);
  assert.equal(run.stats.deliveries, 1);
  assert.ok(run.stats.money > 16000);
  for (let i = 0; i < 60; i++) run.step();
  assert.equal(run.stats.alleys, 1);
});

test("the authored hẻm is a continuous physical dogleg, shorter than the street route", () => {
  const lane = HIDDEN_LANES[0];
  let length = 0;
  for (let i = 1; i < lane.points.length; i++) {
    const a = lane.points[i - 1],
      b = lane.points[i],
      distance = Math.hypot(b.x - a.x, b.z - a.z);
    length += distance;
    for (let step = 0; step <= distance; step++)
      assert.notEqual(
        surface(
          a.x + ((b.x - a.x) * step) / distance,
          a.z + ((b.z - a.z) * step) / distance,
          CONFIG.radius,
        ),
        "wall",
      );
  }
  assert.equal(length, 48);
  assert.ok(length < 72 * 0.7);
  assert.ok(hiddenLaneAt(17, -18));
  assert.equal(surface(13, -18, CONFIG.radius), "wall");
  const run = new Run("discover");
  run.traffic = [];
  Object.assign(run.player, { x: 17, z: -18 });
  for (let i = 0; i < 60; i++) run.step();
  assert.equal(
    run.record.events.filter((e) => e.type === "discovery").length,
    1,
  );
});

test("thread-the-needle requires two different safe passes on opposite sides and restores boost", () => {
  const run = new Run("thread");
  const vehicles = run.traffic.slice(0, 2);
  run.traffic = vehicles;
  // Two stationary fixture scooters flank the rider with safe, close clearance.
  vehicles.forEach((v, i) =>
    Object.assign(v, {
      left: 0,
      top: i === 0 ? -4.8 : -0.8,
      direction: 1,
      phase: 25,
      speed: 0,
      radius: 0.72,
    }),
  );
  Object.assign(run.player, {
    x: 25,
    z: 0,
    speed: 12,
    angle: Math.PI / 2,
    immune: 0,
    boost: 0.2,
  });
  run.step({ ...EMPTY_INPUT, throttle: true });
  assert.ok(vehicles.every((v) => v.near));
  assert.equal(run.stats.threads, 0);
  Object.assign(run.player, { x: 32, z: 0, speed: 12 });
  run.step({ ...EMPTY_INPUT, throttle: true });
  assert.equal(run.stats.nearMisses, 2);
  assert.equal(run.stats.threads, 1);
  assert.ok(run.player.boost > 0.4);
  for (let i = 0; i < 30; i++) run.step();
  assert.equal(run.stats.threads, 1);
  assert.ok(run.moments.some((m) => m.type === "thread"));
});

test("city batching keeps facade streaks off horizontal roads without changing geometry or colours", () => {
  const source = new THREE.Group();
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(178, 0.15, 14),
    new THREE.MeshLambertMaterial({ color: 0x60666a }),
  );
  road.rotation.y = Math.PI / 2;
  source.add(road);
  const original = colouredGeometry(source),
    city = cityGeometry(source);
  assert.deepEqual(
    city.attributes.position.array,
    original.attributes.position.array,
  );
  assert.deepEqual(
    city.attributes.color.array,
    original.attributes.color.array,
  );
  for (let i = 0; i < city.attributes.normal.count; i++) {
    const horizontal = Math.abs(city.attributes.normal.getY(i)) > 0.9;
    for (const axis of ["getX", "getY"])
      if (horizontal) assert.ok(city.attributes.uv[axis](i) > 248 / 256);
      else
        assert.equal(
          city.attributes.uv[axis](i),
          original.attributes.uv[axis](i),
        );
  }
  original.dispose();
  city.dispose();
});

test("batching an already-coloured vehicle preserves its original palette", () => {
  const source = new THREE.Group();
  source.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshLambertMaterial({ color: 0xdd7744 }),
    ),
  );
  const once = colouredGeometry(source),
    nested = new THREE.Group();
  nested.add(new THREE.Mesh(once, vertexMaterial()));
  const twice = colouredGeometry(nested);
  assert.deepEqual(
    Array.from(twice.attributes.color.array),
    Array.from(once.attributes.color.array),
  );
});
