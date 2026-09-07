import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, random } from "../src/game/config.js";
import {
  EXTENT,
  collisionSurface,
  makeTraffic,
  surface,
  trafficPose,
} from "../src/world/map.js";

test("visible paved lots are driveable while visible building masses stay solid", () => {
  // This point is the open courtyard between two rendered shop rows.
  assert.equal(surface(30, 20, CONFIG.radius), "wall");
  assert.equal(collisionSurface(30, 20, CONFIG.radius), "ground");

  // Hẻm 26's large rendered home remains solid for the same collision query.
  assert.equal(collisionSurface(26.5, -25, CONFIG.radius), "wall");
  assert.equal(collisionSurface(90, 0, CONFIG.radius), "wall");
});

test("traffic varies between blocks while preserving headway and junction safety", () => {
  const traffic = makeTraffic(
    random("traffic-flow-regression"),
    CONFIG.trafficCount,
    CONFIG.rushCount,
  );
  const period = (EXTENT - 2) * 2;
  const profiles = new Set(
    traffic.map(
      (vehicle) =>
        `${vehicle.paceAmplitude.toFixed(3)}:${vehicle.paceFrequency.toFixed(3)}:${vehicle.laneBias.toFixed(3)}:${vehicle.wanderAmplitude.toFixed(3)}`,
    ),
  );
  assert.ok(profiles.size > traffic.length * 0.75, "drivers should not share one motion profile");

  for (const vehicle of traffic) {
    if (vehicle.axis === "x")
      assert.equal(Math.sign(vehicle.lane - vehicle.road), -vehicle.direction);
    else
      assert.equal(Math.sign(vehicle.lane - vehicle.road), vehicle.direction);
  }

  let maxLateralVariation = 0;
  for (let sample = 0; sample <= CONFIG.runSeconds * 10; sample++) {
    const time = sample / 10;
    for (const vehicle of traffic) {
      trafficPose(vehicle, time);
      const lateral =
        vehicle.axis === "x"
          ? Math.abs(vehicle.z - vehicle.lane)
          : Math.abs(vehicle.x - vehicle.lane);
      maxLateralVariation = Math.max(maxLateralVariation, lateral);
      assert.ok(lateral < 0.55, `vehicle ${vehicle.id} wandered too far from its lane`);
    }

    for (let i = 0; i < traffic.length; i++)
      for (let j = i + 1; j < traffic.length; j++) {
        const a = traffic[i],
          b = traffic[j];
        if (a.stream !== b.stream) continue;
        const axis = a.axis === "x" ? "x" : "z";
        const separation = Math.abs(a[axis] - b[axis]);
        const wrapped = Math.min(separation, period - separation);
        assert.ok(wrapped > 40, `traffic bunching in stream ${a.stream}`);
      }

    const horizontal = traffic.filter((vehicle) => vehicle.axis === "x"),
      vertical = traffic.filter((vehicle) => vehicle.axis === "z");
    for (const h of horizontal)
      for (const v of vertical) {
        const hInCore = Math.abs(h.x - v.road) < 4;
        const vInCore = Math.abs(v.z - h.road) < 4;
        assert.equal(
          hInCore && vInCore,
          false,
          `junction conflict at ${v.road},${h.road} near ${time.toFixed(1)}s`,
        );
      }
  }
  assert.ok(maxLateralVariation > 0.12, "traffic should visibly relax off exact lane centre");

  const forwardSteps = new Set();
  for (const vehicle of traffic) {
    trafficPose(vehicle, 13);
    const before = vehicle.axis === "x" ? vehicle.x : vehicle.z;
    trafficPose(vehicle, 13.5);
    const after = vehicle.axis === "x" ? vehicle.x : vehicle.z;
    const delta = (after - before) * vehicle.direction;
    // Ignore the few vehicles that wrap across the world boundary in this sample.
    if (delta > 0 && delta < 8) forwardSteps.add(Math.round(delta * 20) / 20);
  }
  assert.ok(
    forwardSteps.size >= 4,
    "seeded drivers should have several observable half-second pacing rhythms",
  );
});
