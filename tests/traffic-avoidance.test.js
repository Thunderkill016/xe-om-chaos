import test from "node:test";
import assert from "node:assert/strict";
import { Run, EMPTY_INPUT } from "../src/game/Run.js";
import { CONFIG } from "../src/game/config.js";
import { trafficPose } from "../src/world/map.js";

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
