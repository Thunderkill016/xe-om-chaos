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

test("traffic stays evenly spaced and perpendicular streams never share a junction core", () => {
  const traffic = makeTraffic(
    random("traffic-flow-regression"),
    CONFIG.trafficCount,
    CONFIG.rushCount,
  );
  const period = (EXTENT - 2) * 2;

  for (const vehicle of traffic) {
    if (vehicle.axis === "x")
      assert.equal(
        Math.sign(vehicle.lane - vehicle.road),
        -vehicle.direction,
      );
    else
      assert.equal(
        Math.sign(vehicle.lane - vehicle.road),
        vehicle.direction,
      );
  }

  for (let sample = 0; sample <= CONFIG.runSeconds * 10; sample++) {
    const time = sample / 10;
    for (const vehicle of traffic) trafficPose(vehicle, time);

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
});
