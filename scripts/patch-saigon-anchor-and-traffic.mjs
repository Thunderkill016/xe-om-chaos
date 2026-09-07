import { readFile, writeFile } from "node:fs/promises";

const path = "src/world/HcmCorridor.js";
let source = await readFile(path, "utf8");
let changed = false;

const replacements = [
  ["lat: 10.77257,", "lat: 10.77211,"],
  ["lon: 106.69802,", "lon: 106.69827,"],
  ["lat: 10.7743,", "lat: 10.77547,"],
  ["lon: 106.7031,", "lon: 106.702148,"],
];
for (const [oldValue, newValue] of replacements) {
  if (source.includes(oldValue)) {
    source = source.replace(oldValue, newValue);
    changed = true;
  }
}

const oldTraffic = `export function worldTrafficPose(vehicle, time) {
  if (vehicle.route === REAL_HCM_CORRIDOR.id) return corridorTrafficPose(vehicle);
  return mapTrafficPose(vehicle, time);
}`;
const newTraffic = `export function worldTrafficPose(vehicle, time) {
  if (vehicle.route === REAL_HCM_CORRIDOR.id) {
    const pose = corridorTrafficPose(vehicle);
    vehicle.x = pose.x;
    vehicle.z = pose.z;
    vehicle.angle = pose.angle;
    return pose;
  }
  return mapTrafficPose(vehicle, time);
}`;
if (source.includes(oldTraffic)) {
  source = source.replace(oldTraffic, newTraffic);
  changed = true;
}

if (!changed) {
  console.log("Anchor/traffic patch already applied or source shape changed.");
  process.exit(0);
}
await writeFile(path, source);
console.log("Corrected Bến Thành/Nguyễn Huệ anchors and corridor traffic pose mutation.");
