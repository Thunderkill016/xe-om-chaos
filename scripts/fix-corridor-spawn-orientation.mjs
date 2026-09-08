import { readFile, writeFile } from "node:fs/promises";

async function patch(path, replacements) {
  let source = await readFile(path, "utf8");
  for (const [from, to] of replacements) {
    if (source.includes(to)) continue;
    if (!source.includes(from)) {
      throw new Error(`Missing patch target in ${path}: ${from.slice(0, 80)}`);
    }
    source = source.replace(from, to);
  }
  await writeFile(path, source);
}

await patch("src/world/HcmCorridor.js", [
  [
    `    vehicle.corridorDistance =
      ((slot + 0.5) / corridorCount) * REAL_HCM_CORRIDOR.length;
    vehicle.corridorDirection = slot % 2 === 0 ? 1 : -1;`,
    `    const physicalProgress = (slot + 0.5) / corridorCount;
    vehicle.corridorDirection = slot % 2 === 0 ? 1 : -1;
    vehicle.corridorDistance =
      vehicle.corridorDirection > 0
        ? physicalProgress * REAL_HCM_CORRIDOR.length
        : (1 - physicalProgress) * REAL_HCM_CORRIDOR.length;`,
  ],
]);

await patch("src/view/PlayCanvasScene.js", [
  [
    `        group.setEulerAngles(0, point.angle * DEG, 0);`,
    `        group.setEulerAngles(
          0,
          (point.angle - side * Math.PI * 0.5) * DEG,
          0,
        );`,
  ],
  [
    `        shop.setLocalPosition(0, 1.35, -2.48 * side);`,
    `        shop.setLocalPosition(0, 1.35, -2.48);`,
  ],
  [
    `        sign.setLocalPosition(0, 2.95, -2.52 * side);`,
    `        sign.setLocalPosition(0, 2.95, -2.52);`,
  ],
  [
    `        awning.setLocalPosition(0, 2.5, -2.76 * side);`,
    `        awning.setLocalPosition(0, 2.5, -2.76);`,
  ],
  [
    `          windows.setLocalPosition(0, y, -2.47 * side);`,
    `          windows.setLocalPosition(0, y, -2.47);`,
  ],
]);

await patch("src/view/BenThanhLandmark.js", [
  [
    `  market.setEulerAngles(0, start.angle * DEG, 0);`,
    `  market.setEulerAngles(0, (start.angle + Math.PI * 0.5) * DEG, 0);`,
  ],
]);

await patch("tests/hcm-corridor.test.js", [
  [
    `  assert.deepEqual(
    new Set(corridorTraffic.map((vehicle) => vehicle.corridorDirection)),
    new Set([-1, 1]),
  );

  for (const time of [0, 3.2, 12.5, 29.75]) {`,
    `  assert.deepEqual(
    new Set(corridorTraffic.map((vehicle) => vehicle.corridorDirection)),
    new Set([-1, 1]),
  );

  const initialPoses = corridorTraffic.map((vehicle) =>
    worldTrafficPose(vehicle, 0),
  );
  assert.ok(
    Math.hypot(
      initialPoses[0].x - initialPoses[1].x,
      initialPoses[0].z - initialPoses[1].z,
    ) >
      REAL_HCM_CORRIDOR.length * 0.3,
    "opposing corridor traffic must start spatially separated instead of forming an artificial choke point",
  );

  for (const time of [0, 3.2, 12.5, 29.75]) {`,
  ],
]);
