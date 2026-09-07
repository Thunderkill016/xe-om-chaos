import { readFile, writeFile } from "node:fs/promises";

const path = "src/world/HcmCorridor.js";
let source = await readFile(path, "utf8");
const pattern = /export function worldTrafficPose\(vehicle, time\) \{\s*if \(vehicle\.route === REAL_HCM_CORRIDOR\.id\)\s*return corridorTrafficPose\(vehicle\);\s*return mapTrafficPose\(vehicle, time\);\s*\}/m;
const replacement = `export function worldTrafficPose(vehicle, time) {
  if (vehicle.route === REAL_HCM_CORRIDOR.id) {
    const pose = corridorTrafficPose(vehicle);
    vehicle.x = pose.x;
    vehicle.z = pose.z;
    vehicle.angle = pose.angle;
    return pose;
  }
  return mapTrafficPose(vehicle, time);
}`;
if (!pattern.test(source)) {
  console.log("Corridor traffic mutation already applied or source shape changed.");
  process.exit(0);
}
source = source.replace(pattern, replacement);
await writeFile(path, source);
console.log("Corridor traffic pose now mutates vehicle state like the legacy traffic pose.");
