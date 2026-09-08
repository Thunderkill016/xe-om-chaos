import test from "node:test";
import assert from "node:assert/strict";
import { Run, EMPTY_INPUT } from "../src/game/Run.js";
import { CONFIG } from "../src/game/config.js";
import { ROAD_HALF, trafficPose } from "../src/world/map.js";

function stoppedRiderFixture(phase = 30) {
  const run = new Run("traffic-avoidance-regression");
  const vehicle = run.traffic.find(
    (candidate) =>
      candidate.kind === "bike" &&
      candidate.axis === "z" &&
      candidate.id < CONFIG.trafficCount,
  );
  assert.ok(vehicle);
  run.traffic = [vehicle];
  Object.assign(vehicle, {
    phase,
    speed: 0,
    spawnBlocked: false,
    active: true,
    avoidOffset: 0,
  });
  trafficPose(vehicle, 0);
  Object.assign(run.player, {
    x: vehicle.x + Math.sin(vehicle.angle) * 4,
    z: vehicle.z + Math.cos(vehicle.angle) * 4,
    speed: 0,
    vx: 0,
    vz: 0,
    recovery: 0,
    immune: 10,
  });
  return { run, vehicle };
}

test("traffic eases around a stopped rider and returns to lane without snapping", () => {
  const { run, vehicle } = stoppedRiderFixture();
  const offsets = [];
  for (let i = 0; i < 30; i++) {
    run.step(EMPTY_INPUT);
    offsets.push(vehicle.avoidOffset ?? 0);
  }

  assert.ok(Math.abs(offsets.at(-1)) > 0.4);
  for (let i = 1; i < offsets.length; i++)
    assert.ok(
      Math.abs(offsets[i] - offsets[i - 1]) < 0.08,
      "avoidance should ease instead of teleporting laterally",
    );

  run.player.x += 12;
  const leaving = [];
  for (let i = 0; i < 90; i++) {
    run.step(EMPTY_INPUT);
    leaving.push(vehicle.avoidOffset ?? 0);
  }
  assert.ok(Math.abs(leaving.at(-1)) < 0.02);
  assert.equal(run.stats.crashes, 0);
});

test("traffic does not weave sideways inside a junction core", () => {
  const { run, vehicle } = stoppedRiderFixture(87);
  for (let i = 0; i < 30; i++) run.step(EMPTY_INPUT);
  assert.equal(vehicle.avoidOffset ?? 0, 0);
});

test("roadblock waits for a clean gap and traffic bends around its visible body", () => {
  const run = new Run("roadblock-traffic-regression");
  Object.assign(run.player, {
    x: 72,
    z: -72,
    speed: 0,
    vx: 0,
    vz: 0,
    immune: 999,
  });
  let sawBarrier = false,
    crossings = 0;

  for (let tick = 0; tick < 135 / CONFIG.step; tick++) {
    run.step(EMPTY_INPUT);
    const barrier = run.director.barrier;
    if (!barrier.active) continue;
    sawBarrier = true;

    for (const vehicle of run.traffic) {
      if (!vehicle.active || vehicle.axis !== "z" || vehicle.road !== barrier.x)
        continue;
      const halfWidth = vehicle.halfWidth ?? 0.5,
        halfLength = vehicle.halfLength ?? 1.2,
        longitudinalOverlap =
          Math.abs(vehicle.z - barrier.z) < barrier.d / 2 + halfLength + 0.05;
      if (!longitudinalOverlap) continue;
      crossings++;
      assert.ok(
        Math.abs(vehicle.x - barrier.x) > barrier.w / 2 + halfWidth,
        `vehicle ${vehicle.id} crossed through the roadblock`,
      );
      assert.ok(
        Math.abs(vehicle.x - vehicle.road) + halfWidth < ROAD_HALF,
        `vehicle ${vehicle.id} left the paved avenue to avoid the roadblock`,
      );
    }
  }

  assert.equal(sawBarrier, true);
  assert.ok(crossings > 0);
});
