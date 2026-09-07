import test from "node:test";
import assert from "node:assert/strict";
import { CONFIG, random } from "../src/game/config.js";
import {
  REAL_HCM_CORRIDOR,
  REAL_HCM_CORRIDOR_BUILDINGS,
  REAL_HCM_CORRIDOR_STOPS,
  makeWorldTraffic,
  realCorridorDistance,
  realCorridorSurface,
  worldCollisionSurface,
  worldTrafficPose,
} from "../src/world/HcmCorridor.js";

test("playable corridor is derived from committed OpenStreetMap road geometry", () => {
  assert.equal(REAL_HCM_CORRIDOR.source, "OpenStreetMap");
  assert.ok(REAL_HCM_CORRIDOR.points.length >= 2);
  assert.ok(REAL_HCM_CORRIDOR.sourceLength >= 60);
  assert.ok(REAL_HCM_CORRIDOR.length > 20);
  assert.ok(REAL_HCM_CORRIDOR.width >= 4.8);
  assert.deepEqual(REAL_HCM_CORRIDOR.points[0], { x: 0, z: 72 });
  assert.ok(
    REAL_HCM_CORRIDOR.points.at(-1).z > 82,
    "the normalized corridor should leave the existing north avenue instead of folding back into the core",
  );
});

test("corridor stops are on the same visible and collision-backed road", () => {
  assert.equal(REAL_HCM_CORRIDOR_STOPS.length, 2);
  for (const stop of REAL_HCM_CORRIDOR_STOPS) {
    assert.ok(
      realCorridorDistance(stop.x, stop.z) < REAL_HCM_CORRIDOR.width * 0.25,
    );
    assert.equal(realCorridorSurface(stop.x, stop.z, CONFIG.radius), "road");
    assert.equal(worldCollisionSurface(stop.x, stop.z, CONFIG.radius), "road");
  }
  assert.ok(
    Math.hypot(
      REAL_HCM_CORRIDOR_STOPS[1].x - REAL_HCM_CORRIDOR_STOPS[0].x,
      REAL_HCM_CORRIDOR_STOPS[1].z - REAL_HCM_CORRIDOR_STOPS[0].z,
    ) > 12,
  );
});

test("nearby OSM buildings remain solid while the corridor stays open", () => {
  assert.ok(REAL_HCM_CORRIDOR_BUILDINGS.length > 0);
  const building = REAL_HCM_CORRIDOR_BUILDINGS[0];
  assert.equal(
    realCorridorSurface(building.x, building.z, CONFIG.radius),
    "wall",
  );
  const midpoint =
    REAL_HCM_CORRIDOR.points[Math.floor(REAL_HCM_CORRIDOR.points.length / 2)];
  assert.notEqual(
    realCorridorSurface(midpoint.x, midpoint.z, CONFIG.radius),
    "wall",
  );
});

test("a bounded share of live traffic follows the OSM corridor in both directions", () => {
  const traffic = makeWorldTraffic(
    random("hcm-corridor-traffic"),
    CONFIG.trafficCount,
    CONFIG.rushCount,
  );
  const corridorTraffic = traffic.filter(
    (vehicle) => vehicle.route === REAL_HCM_CORRIDOR.id,
  );
  assert.equal(corridorTraffic.length, Math.min(4, CONFIG.trafficCount));
  assert.deepEqual(
    new Set(corridorTraffic.map((vehicle) => vehicle.direction)),
    new Set([-1, 1]),
  );

  for (const time of [0, 3.2, 12.5, 29.75]) {
    for (const vehicle of corridorTraffic) {
      worldTrafficPose(vehicle, time);
      assert.ok(Number.isFinite(vehicle.x) && Number.isFinite(vehicle.z));
      assert.ok(
        realCorridorDistance(vehicle.x, vehicle.z) <
          REAL_HCM_CORRIDOR.width * 0.5,
        `corridor traffic ${vehicle.id} left the rendered road at ${time}s`,
      );
    }
  }
});
