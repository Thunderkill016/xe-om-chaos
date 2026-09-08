import test from "node:test";
import assert from "node:assert/strict";
import { MENU_CAMERA, resolveCameraPosition } from "../src/view/CameraRig.js";

test("menu camera starts on the clear north-south avenue behind the rider", () => {
  assert.equal(MENU_CAMERA.position.x, 3);
  assert.ok(MENU_CAMERA.position.z < -43);
  assert.ok(MENU_CAMERA.target.z > -43);
});

test("camera stays at its desired point when the sightline is clear", () => {
  const desired = { x: 0, z: -10 };
  assert.deepEqual(resolveCameraPosition({ x: 0, z: 0 }, desired, []), desired);
});

test("camera pulls in before a building instead of crossing through it", () => {
  const player = { x: 0, z: 0 };
  const desired = { x: 0, z: -10 };
  const wall = [{ x: 0, z: -6, w: 6, d: 2 }];
  const resolved = resolveCameraPosition(player, desired, wall, 0);

  assert.ok(resolved.z > -5, `camera stopped at z=${resolved.z}`);
  assert.ok(resolved.z < 0);
});
