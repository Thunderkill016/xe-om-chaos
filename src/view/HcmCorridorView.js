import * as THREE from "three";
import {
  REAL_HCM_CORRIDOR,
  REAL_HCM_CORRIDOR_BUILDINGS,
  REAL_HCM_CORRIDOR_STOPS,
} from "../world/HcmCorridor.js";
import { cityChunks } from "./batch.js";

const FACADE_LOW = [0xd0b991, 0xc88f75, 0x9baa92, 0xd8c9aa, 0x84999b];
const FACADE_HIGH = [0x526d76, 0x617b82, 0x72888d, 0x4f6570];

function ribbon(view, parent, a, b, width, colour, y = 0.11) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.2) return;
  const mesh = view.mesh(
    parent,
    colour,
    (a.x + b.x) * 0.5,
    y,
    (a.z + b.z) * 0.5,
    width,
    0.12,
    length,
  );
  mesh.rotation.y = Math.atan2(dx, dz);
}

function laneMarks(view, parent, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < 5) return;
  const angle = Math.atan2(dx, dz);
  const count = Math.max(1, Math.floor(length / 7));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const mesh = view.mesh(
      parent,
      0xe8d7a6,
      a.x + dx * t,
      0.19,
      a.z + dz * t,
      0.13,
      0.025,
      Math.min(2.6, (length / count) * 0.48),
    );
    mesh.rotation.y = angle;
  }
}

function buildingAabb(building) {
  const c = Math.abs(Math.cos(building.angle));
  const s = Math.abs(Math.sin(building.angle));
  return {
    x: building.x,
    z: building.z,
    w: building.w * c + building.d * s,
    d: building.w * s + building.d * c,
  };
}

function addStopBeacon(view, parent, stop, index) {
  const post = view.mesh(
    parent,
    0x315c59,
    stop.x,
    1.6,
    stop.z,
    0.14,
    3.2,
    0.14,
  );
  post.rotation.y = index * Math.PI;
  const cap = view.mesh(
    parent,
    index === 0 ? 0xffc668 : 0x85f3c5,
    stop.x,
    3.15,
    stop.z,
    0.62,
    0.18,
    0.62,
  );
  cap.rotation.y = Math.PI / 4;
}

export function addPlayableHcmCorridor(view) {
  const solid = new THREE.Group();
  solid.name = "HCMC_PLAYABLE_CORRIDOR_SOURCE";

  for (let i = 1; i < REAL_HCM_CORRIDOR.points.length; i++) {
    const a = REAL_HCM_CORRIDOR.points[i - 1];
    const b = REAL_HCM_CORRIDOR.points[i];
    ribbon(view, solid, a, b, REAL_HCM_CORRIDOR.shoulderWidth, 0xb9b29f, 0.075);
    ribbon(view, solid, a, b, REAL_HCM_CORRIDOR.width, 0x343a3d, 0.14);
    laneMarks(view, solid, a, b);
  }

  for (let index = 0; index < REAL_HCM_CORRIDOR_BUILDINGS.length; index++) {
    const building = REAL_HCM_CORRIDOR_BUILDINGS[index];
    const high =
      building.h > 10 ||
      ["office", "hotel", "commercial", "apartments"].includes(building.kind);
    const palette = high ? FACADE_HIGH : FACADE_LOW;
    const colour =
      palette[(index * 5 + Math.round(building.h)) % palette.length];
    const mesh = view.mesh(
      solid,
      colour,
      building.x,
      building.h * 0.5,
      building.z,
      building.w,
      building.h,
      building.d,
    );
    mesh.rotation.y = building.angle;
    if (high && building.h > 7) {
      const roof = view.mesh(
        solid,
        0x506568,
        building.x,
        building.h + 0.16,
        building.z,
        Math.max(1.4, building.w * 0.82),
        0.28,
        Math.max(1.4, building.d * 0.82),
      );
      roof.rotation.y = building.angle;
    }
    view.buildingFootprints.push(buildingAabb(building));
  }

  REAL_HCM_CORRIDOR_STOPS.forEach((stop, index) =>
    addStopBeacon(view, solid, stop, index),
  );

  const batch = cityChunks(solid);
  batch.name = "HCMC_PLAYABLE_OSM_CORRIDOR";
  view.root.add(batch);
  view.realHcmCorridor = batch;
  view.realHcmCorridorStats = {
    id: REAL_HCM_CORRIDOR.id,
    source: REAL_HCM_CORRIDOR.source,
    sourceType: REAL_HCM_CORRIDOR.sourceType,
    sourceLength: REAL_HCM_CORRIDOR.sourceLength,
    gameLength: REAL_HCM_CORRIDOR.length,
    buildings: REAL_HCM_CORRIDOR_BUILDINGS.length,
  };
  return batch;
}
