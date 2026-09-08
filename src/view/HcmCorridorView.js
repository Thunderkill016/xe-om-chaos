import * as THREE from "three";
import {
  REAL_HCM_CORRIDOR,
  REAL_HCM_CORRIDOR_BUILDINGS,
  REAL_HCM_CORRIDOR_STOPS,
} from "../world/HcmCorridor.js";
import { cityChunks } from "./batch.js";

const ASPHALT = 0x30363a;
const ASPHALT_PATCH = 0x3a4143;
const URBAN_GROUND = 0x77776d;
const SIDEWALK = 0xb8ad95;
const CURB = 0xd8ccb0;
const GUTTER = 0x4a4d49;
const ROAD_MARK = 0xeadfba;
const TREE_TRUNK = 0x65503f;
const TREE_GREEN = 0x4e7358;
const LAMP_METAL = 0x4a5b5b;
const LAMP_WARM = 0xf0bc72;
const SHOP_GLASS = 0x6f9296;
const SHOP_DARK = 0x334d50;
const SIGN_ORANGE = 0xd96f47;
const SIGN_TEAL = 0x3f7471;
const FACADE_LOW = [0xd0b991, 0xc88f75, 0x9baa92, 0xd8c9aa, 0x84999b];
const FACADE_HIGH = [0x526d76, 0x617b82, 0x72888d, 0x4f6570];

function frame(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.001)
    return { dx: 0, dz: 1, length: 0, angle: 0, nx: -1, nz: 0 };
  const tx = dx / length;
  const tz = dz / length;
  return {
    dx,
    dz,
    length,
    angle: Math.atan2(dx, dz),
    nx: -tz,
    nz: tx,
  };
}

function ribbon(
  view,
  parent,
  a,
  b,
  width,
  colour,
  y = 0.11,
  lateral = 0,
  height = 0.12,
) {
  const segment = frame(a, b);
  if (segment.length < 0.2) return null;
  const mesh = view.mesh(
    parent,
    colour,
    (a.x + b.x) * 0.5 + segment.nx * lateral,
    y,
    (a.z + b.z) * 0.5 + segment.nz * lateral,
    width,
    height,
    segment.length + 0.22,
  );
  mesh.rotation.y = segment.angle;
  return mesh;
}

function laneMarks(view, parent, a, b) {
  const segment = frame(a, b);
  if (segment.length < 5) return 0;
  const count = Math.max(1, Math.floor(segment.length / 7));
  let made = 0;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const mesh = view.mesh(
      parent,
      ROAD_MARK,
      a.x + segment.dx * t,
      0.225,
      a.z + segment.dz * t,
      0.13,
      0.025,
      Math.min(2.5, (segment.length / count) * 0.48),
    );
    mesh.rotation.y = segment.angle;
    made++;
  }
  return made;
}

function roadEdges(view, parent, a, b) {
  const offset = REAL_HCM_CORRIDOR.width * 0.5 - 0.34;
  ribbon(view, parent, a, b, 0.08, 0xd4c9a8, 0.219, offset, 0.018);
  ribbon(view, parent, a, b, 0.08, 0xd4c9a8, 0.219, -offset, 0.018);
}

function sidewalkEdges(view, parent, a, b) {
  const roadEdge = REAL_HCM_CORRIDOR.width * 0.5 + 0.18;
  const walkOffset =
    REAL_HCM_CORRIDOR.width * 0.5 +
    (REAL_HCM_CORRIDOR.shoulderWidth - REAL_HCM_CORRIDOR.width) * 0.25;
  const walkWidth = Math.max(
    1.2,
    (REAL_HCM_CORRIDOR.shoulderWidth - REAL_HCM_CORRIDOR.width) * 0.5,
  );
  ribbon(view, parent, a, b, walkWidth, SIDEWALK, 0.115, walkOffset, 0.16);
  ribbon(view, parent, a, b, walkWidth, SIDEWALK, 0.115, -walkOffset, 0.16);
  ribbon(view, parent, a, b, 0.24, CURB, 0.215, roadEdge, 0.2);
  ribbon(view, parent, a, b, 0.24, CURB, 0.215, -roadEdge, 0.2);
  ribbon(view, parent, a, b, 0.13, GUTTER, 0.2, roadEdge - 0.22, 0.025);
  ribbon(view, parent, a, b, 0.13, GUTTER, 0.2, -roadEdge + 0.22, 0.025);
}

function samplePolyline(distanceValue) {
  const target = Math.max(0, Math.min(REAL_HCM_CORRIDOR.length, distanceValue));
  let travelled = 0;
  for (let index = 1; index < REAL_HCM_CORRIDOR.points.length; index++) {
    const a = REAL_HCM_CORRIDOR.points[index - 1];
    const b = REAL_HCM_CORRIDOR.points[index];
    const segment = frame(a, b);
    if (
      travelled + segment.length >= target ||
      index === REAL_HCM_CORRIDOR.points.length - 1
    ) {
      const t =
        segment.length <= 1e-6
          ? 0
          : Math.max(0, Math.min(1, (target - travelled) / segment.length));
      return {
        x: a.x + segment.dx * t,
        z: a.z + segment.dz * t,
        tx: segment.length ? segment.dx / segment.length : 0,
        tz: segment.length ? segment.dz / segment.length : 1,
        nx: segment.nx,
        nz: segment.nz,
        angle: segment.angle,
      };
    }
    travelled += segment.length;
  }
  const end = REAL_HCM_CORRIDOR.points.at(-1);
  return { ...end, tx: 0, tz: 1, nx: -1, nz: 0, angle: 0 };
}

function nearestRoadFrame(x, z) {
  let best = { distance: Infinity, point: samplePolyline(0) };
  for (let distance = 0; distance <= REAL_HCM_CORRIDOR.length; distance += 2) {
    const point = samplePolyline(distance);
    const candidate = Math.hypot(point.x - x, point.z - z);
    if (candidate < best.distance) best = { distance: candidate, point };
  }
  return best.point;
}

function tree(view, parent, x, z, scale = 1) {
  view.mesh(
    parent,
    TREE_TRUNK,
    x,
    1.15 * scale,
    z,
    0.18 * scale,
    2.3 * scale,
    0.18 * scale,
    view.cylinder,
  );
  view.mesh(
    parent,
    TREE_GREEN,
    x,
    3.05 * scale,
    z,
    1.35 * scale,
    1.7 * scale,
    1.35 * scale,
    view.sphere,
  );
}

function streetLamp(view, parent, x, z, angle) {
  const pole = view.mesh(
    parent,
    LAMP_METAL,
    x,
    2.2,
    z,
    0.1,
    4.4,
    0.1,
    view.cylinder,
  );
  pole.rotation.y = angle;
  view.mesh(parent, LAMP_WARM, x, 4.5, z, 0.24, 0.2, 0.24, view.sphere);
}

function parkedScooter(view, parent, point, side, index) {
  if (typeof view.makeBike !== "function") return false;
  const offset = REAL_HCM_CORRIDOR.shoulderWidth * 0.5 + 0.75;
  const scooter = view.makeBike(index % 2 ? 0x5f9187 : 0xc96f4b, false);
  scooter.scale.setScalar(0.72);
  scooter.position.set(
    point.x + point.nx * offset * side,
    0.01,
    point.z + point.nz * offset * side,
  );
  scooter.rotation.y = point.angle + (side > 0 ? 0.08 : -0.08);
  parent.add(scooter);
  return true;
}

function addStreetFurniture(view, parent) {
  let streetTrees = 0;
  let streetLights = 0;
  let parkedScooters = 0;
  const offset = REAL_HCM_CORRIDOR.shoulderWidth * 0.5 + 1.05;
  let index = 0;
  for (
    let distance = 8;
    distance < REAL_HCM_CORRIDOR.length - 5;
    distance += 11
  ) {
    const point = samplePolyline(distance);
    const treeSide = index % 2 === 0 ? 1 : -1;
    tree(
      view,
      parent,
      point.x + point.nx * offset * treeSide,
      point.z + point.nz * offset * treeSide,
      0.78 + (index % 3) * 0.08,
    );
    streetTrees++;
    if (index % 2 === 0) {
      const lampSide = -treeSide;
      streetLamp(
        view,
        parent,
        point.x + point.nx * offset * lampSide,
        point.z + point.nz * offset * lampSide,
        point.angle,
      );
      streetLights++;
    }
    if (index % 3 === 1 && parkedScooter(view, parent, point, treeSide, index))
      parkedScooters++;
    index++;
  }
  return { streetTrees, streetLights, parkedScooters };
}

function faceTowardRoad(building) {
  const road = nearestRoadFrame(building.x, building.z);
  const dx = road.x - building.x;
  const dz = road.z - building.z;
  const c = Math.cos(building.angle);
  const s = Math.sin(building.angle);
  const localX = dx * c - dz * s;
  const localZ = dx * s + dz * c;
  if (Math.abs(localZ) >= Math.abs(localX))
    return { axis: "z", sign: Math.sign(localZ) || -1 };
  return { axis: "x", sign: Math.sign(localX) || 1 };
}

function facadePanel(
  view,
  group,
  building,
  face,
  colour,
  y,
  height,
  spanScale,
  offset = 0.04,
) {
  if (face.axis === "z")
    return view.mesh(
      group,
      colour,
      0,
      y,
      face.sign * (building.d * 0.5 + offset),
      Math.max(0.7, building.w * spanScale),
      height,
      0.07,
    );
  return view.mesh(
    group,
    colour,
    face.sign * (building.w * 0.5 + offset),
    y,
    0,
    0.07,
    height,
    Math.max(0.7, building.d * spanScale),
  );
}

function awning(view, group, building, face, colour) {
  if (face.axis === "z")
    return view.mesh(
      group,
      colour,
      0,
      2.75,
      face.sign * (building.d * 0.5 + 0.24),
      Math.max(1.3, building.w * 0.78),
      0.16,
      0.48,
    );
  return view.mesh(
    group,
    colour,
    face.sign * (building.w * 0.5 + 0.24),
    2.75,
    0,
    0.48,
    0.16,
    Math.max(1.3, building.d * 0.78),
  );
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

function addBuilding(view, parent, building, index) {
  const high =
    building.h > 10 ||
    ["office", "hotel", "commercial", "apartments"].includes(building.kind);
  const palette = high ? FACADE_HIGH : FACADE_LOW;
  const colour = palette[(index * 5 + Math.round(building.h)) % palette.length];
  const group = new THREE.Group();
  group.position.set(building.x, 0, building.z);
  group.rotation.y = building.angle;
  parent.add(group);

  view.mesh(
    group,
    0x6f695e,
    0,
    0.26,
    0,
    building.w + 0.18,
    0.52,
    building.d + 0.18,
  );
  view.mesh(
    group,
    colour,
    0,
    building.h * 0.5 + 0.24,
    0,
    building.w,
    Math.max(1.6, building.h - 0.48),
    building.d,
  );

  const face = faceTowardRoad(building);
  const signColour = index % 2 ? SIGN_ORANGE : SIGN_TEAL;
  facadePanel(view, group, building, face, SHOP_DARK, 1.45, 2.15, 0.84, 0.055);
  facadePanel(view, group, building, face, SHOP_GLASS, 1.4, 1.72, 0.72, 0.09);
  facadePanel(view, group, building, face, signColour, 3.22, 0.62, 0.66, 0.075);
  awning(view, group, building, face, index % 3 === 0 ? 0xd89b5b : 0x6d8b7c);

  let windowRows = 0;
  for (
    let floor = 4.5;
    floor < building.h - 1.1 && windowRows < 5;
    floor += 3.1
  ) {
    facadePanel(
      view,
      group,
      building,
      face,
      index % 4 === 0 ? 0xd8ae70 : 0x73959a,
      floor,
      0.74,
      high ? 0.62 : 0.48,
      0.055,
    );
    windowRows++;
  }

  if (building.h > 6) {
    const roof = view.mesh(
      group,
      high ? 0x506568 : 0x746b5e,
      0,
      building.h + 0.16,
      0,
      Math.max(1.4, building.w * 0.84),
      0.28,
      Math.max(1.4, building.d * 0.84),
    );
    roof.rotation.y = 0;
  }

  view.buildingFootprints.push(buildingAabb(building));
  return { shopfront: 1, windowRows };
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
  let laneMarkCount = 0;
  let sidewalkSegments = 0;

  for (let index = 1; index < REAL_HCM_CORRIDOR.points.length; index++) {
    const a = REAL_HCM_CORRIDOR.points[index - 1];
    const b = REAL_HCM_CORRIDOR.points[index];
    ribbon(
      view,
      solid,
      a,
      b,
      REAL_HCM_CORRIDOR.shoulderWidth + 9,
      URBAN_GROUND,
      0.025,
      0,
      0.05,
    );
    ribbon(
      view,
      solid,
      a,
      b,
      REAL_HCM_CORRIDOR.shoulderWidth,
      SIDEWALK,
      0.075,
      0,
      0.11,
    );
    ribbon(view, solid, a, b, REAL_HCM_CORRIDOR.width, ASPHALT, 0.145, 0, 0.13);
    if (index % 2 === 0)
      ribbon(
        view,
        solid,
        a,
        b,
        Math.max(0.9, REAL_HCM_CORRIDOR.width * 0.36),
        ASPHALT_PATCH,
        0.216,
        index % 4 === 0 ? 0.35 : -0.35,
        0.018,
      );
    sidewalkEdges(view, solid, a, b);
    roadEdges(view, solid, a, b);
    laneMarkCount += laneMarks(view, solid, a, b);
    sidewalkSegments += 2;
  }

  let shopfronts = 0;
  let facadeWindowRows = 0;
  for (let index = 0; index < REAL_HCM_CORRIDOR_BUILDINGS.length; index++) {
    const detail = addBuilding(
      view,
      solid,
      REAL_HCM_CORRIDOR_BUILDINGS[index],
      index,
    );
    shopfronts += detail.shopfront;
    facadeWindowRows += detail.windowRows;
  }

  const furniture = addStreetFurniture(view, solid);
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
    shopfronts,
    facadeWindowRows,
    streetTrees: furniture.streetTrees,
    streetLights: furniture.streetLights,
    parkedScooters: furniture.parkedScooters,
    sidewalkSegments,
    laneMarks: laneMarkCount,
  };
  return batch;
}
