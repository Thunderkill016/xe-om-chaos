import * as THREE from "three";
import { random } from "../game/config.js";
import { cityChunks } from "./batch.js";

// Ported from the Blender downtown generator supplied for the project.
// The source generator projects real HCMC coordinates in metres across the
// Bến Thành -> Nguyễn Huệ -> Ba Son -> Saigon River area. In the browser game
// we compress the same coordinate frame into a cinematic outer shell so the
// established gameplay road/collision graph can stay stable during this visual pass.
// Data source convention: OpenStreetMap contributors (ODbL).
const SOUTH = 10.768;
const WEST = 106.693;
const NORTH = 10.79;
const EAST = 106.716;
const METERS_PER_DEG_LAT = 111_320;
const CENTER_LAT = (SOUTH + NORTH) * 0.5;
const CENTER_LON = (WEST + EAST) * 0.5;
const METERS_PER_DEG_LON =
  METERS_PER_DEG_LAT * Math.cos((CENTER_LAT * Math.PI) / 180);
const GAME_SCALE = 0.12;
const PLAYABLE_RING = 96;

const LANDMARKS = {
  benThanh: { lat: 10.77257, lon: 106.69802 },
  nguyenHue: { lat: 10.7743, lon: 106.7031 },
  cityHall: { lat: 10.77654, lon: 106.70091 },
  bitexco: { lat: 10.77186, lon: 106.70446 },
  baSon: { lat: 10.7819, lon: 106.7126 },
};

const FACADES = [
  0x8a8a82, 0xa07f67, 0xc2b9a3, 0x536d78, 0x716f66, 0xc9c3b4, 0x667e7b,
];
const WINDOW = 0x88a9ae;
const WARM_WINDOW = 0xe1b267;
const ASPHALT = 0x4a5054;
const PAVEMENT = 0xbeb79f;
const GREEN = 0x557a62;
const WATER = 0x3f858f;

function project(lat, lon) {
  return {
    x: (lon - CENTER_LON) * METERS_PER_DEG_LON * GAME_SCALE,
    z: (lat - CENTER_LAT) * METERS_PER_DEG_LAT * GAME_SCALE,
  };
}

function outsideGameplay(point, radius = PLAYABLE_RING) {
  const length = Math.hypot(point.x, point.z);
  if (length >= radius || length < 0.001) return point;
  const scale = radius / length;
  return { x: point.x * scale, z: point.z * scale };
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

export function addDowntownCinematic(view) {
  const rng = random("hcmc-downtown-osm-shell-v1");
  const solid = new THREE.Group();
  const box = (colour, x, y, z, w, h, d, geometry = view.box, parent = solid) =>
    view.mesh(parent, colour, x, y, z, w, h, d, geometry);

  const groupAt = (point, angle = 0) => {
    const group = new THREE.Group();
    group.position.set(point.x, 0, point.z);
    group.rotation.y = angle;
    solid.add(group);
    return group;
  };

  const localBox = (parent, colour, x, y, z, w, h, d, geometry = view.box) =>
    view.mesh(parent, colour, x, y, z, w, h, d, geometry);

  const tree = (x, z, scale = 1) => {
    box(
      0x655241,
      x,
      1.35 * scale,
      z,
      0.22 * scale,
      2.7 * scale,
      0.22 * scale,
      view.cylinder,
    );
    box(
      GREEN,
      x,
      3.3 * scale,
      z,
      1.6 * scale,
      1.8 * scale,
      1.6 * scale,
      view.sphere,
    );
  };

  const windowBands = (parent, width, depth, height, front = -1) => {
    const floors = Math.max(2, Math.floor(height / 4));
    for (let floor = 1; floor < floors; floor++) {
      const y = 2.5 + floor * 3.5;
      if (y > height - 1.5) break;
      for (let x = -width * 0.32; x <= width * 0.32; x += 2.8)
        localBox(
          parent,
          floor % 3 === 0 ? WARM_WINDOW : WINDOW,
          x,
          y,
          front * (depth / 2 + 0.055),
          1.35,
          1.1,
          0.08,
        );
    }
  };

  const tower = (point, width, depth, height, colour, angle = 0) => {
    const group = groupAt(point, angle);
    localBox(group, colour, 0, height * 0.5, 0, width, height, depth);
    localBox(
      group,
      0x465d62,
      0,
      height + 0.25,
      0,
      width + 0.35,
      0.5,
      depth + 0.35,
    );
    windowBands(group, width, depth, height);
    return group;
  };

  const roadRibbon = (a, b, width, colour, y = 0.03) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const mesh = box(
      colour,
      (a.x + b.x) * 0.5,
      y,
      (a.z + b.z) * 0.5,
      width,
      0.08,
      length,
    );
    mesh.rotation.y = Math.atan2(dx, dz);
    return mesh;
  };

  // Saigon River and Bach Dang-style promenade. The original map already keeps
  // the river outside the riding wall; this pass broadens it into a real horizon
  // feature and adds the dense tree/lamp rhythm visible from downtown streets.
  box(WATER, 116, -0.34, 8, 48, 0.12, 260);
  box(PAVEMENT, 91.5, 0.08, 8, 4.8, 0.18, 220);
  for (let z = -98; z <= 112; z += 11) {
    tree(89.8 + (Math.floor((z + 100) / 11) % 2) * 1.1, z, 0.82);
    box(0x5c6865, 93.2, 2.1, z + 3.4, 0.13, 4.2, 0.13, view.cylinder);
    box(WARM_WINDOW, 93.2, 4.3, z + 3.4, 0.32, 0.22, 0.32, view.sphere);
  }

  const benThanh = outsideGameplay(
    project(LANDMARKS.benThanh.lat, LANDMARKS.benThanh.lon),
  );
  const bitexco = outsideGameplay(
    project(LANDMARKS.bitexco.lat, LANDMARKS.bitexco.lon),
  );
  const nguyenHue = outsideGameplay(
    project(LANDMARKS.nguyenHue.lat, LANDMARKS.nguyenHue.lon),
  );
  const cityHall = outsideGameplay(
    project(LANDMARKS.cityHall.lat, LANDMARKS.cityHall.lon),
  );
  const baSon = outsideGameplay(
    project(LANDMARKS.baSon.lat, LANDMARKS.baSon.lon),
  );

  // Bến Thành silhouette: broad market hall, warm roof and clock tower. It sits
  // on the same projected bearing as the real market but remains just outside
  // the gameplay wall until the road graph itself is migrated to OSM.
  {
    const g = groupAt(benThanh, -0.12);
    localBox(g, 0xc3b48d, 0, 4.2, 0, 26, 8.4, 19);
    const roof = localBox(g, 0xa94f3b, 0, 9.1, 0, 28, 1.7, 21);
    roof.rotation.z = 0.035;
    localBox(g, 0xd4c39d, 0, 12.7, -7.6, 6.5, 9, 4.2);
    localBox(g, 0xa94f3b, 0, 17.4, -7.6, 7.4, 0.9, 5.1);
    localBox(g, 0xf0e1bb, 0, 14.2, -9.8, 2.2, 2.2, 0.18);
    localBox(g, 0x405a5c, 0, 14.2, -9.92, 1.6, 1.6, 0.06, view.cylinder);
    for (let x = -10; x <= 10; x += 4)
      localBox(g, 0x5f6e66, x, 2.3, -9.65, 1.7, 3.5, 0.12);
  }

  // Nguyễn Huệ is represented as a bright ceremonial ribbon in the cinematic
  // shell, with tree rows and the city-hall mass anchoring its north end.
  roadRibbon(cityHall, nguyenHue, 12, 0xa7a995, 0.025);
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    const x = mix(cityHall.x, nguyenHue.x, t);
    const z = mix(cityHall.z, nguyenHue.z, t);
    const dx = nguyenHue.x - cityHall.x;
    const dz = nguyenHue.z - cityHall.z;
    const length = Math.hypot(dx, dz) || 1;
    const ox = (-dz / length) * 6.8;
    const oz = (dx / length) * 6.8;
    tree(x + ox, z + oz, 0.65);
    tree(x - ox, z - oz, 0.65);
  }
  {
    const g = groupAt(cityHall, 0.58);
    localBox(g, 0xe2c8a1, 0, 5.5, 0, 28, 11, 12);
    localBox(g, 0xb55b45, 0, 11.5, 0, 30, 1.4, 14);
    localBox(g, 0xe8d5ad, 0, 12.8, -1, 7, 8, 7);
    localBox(g, 0xb55b45, 0, 17.1, -1, 8.5, 0.9, 8.5);
    for (let x = -10; x <= 10; x += 5)
      localBox(g, 0x6e8580, x, 5.4, -6.08, 2, 3.4, 0.12);
  }

  // Bitexco-inspired profile: a faceted elliptical body and the side helipad
  // are enough for instant skyline recognition without a heavy unique model.
  {
    const g = groupAt(bitexco, 0.2);
    localBox(g, 0x506e78, 0, 28, 0, 12, 56, 9, view.cylinder);
    localBox(g, 0x668890, 0, 61, 0, 8.2, 10, 6.2, view.cylinder);
    for (let y = 6; y < 58; y += 4.2)
      localBox(
        g,
        y % 8.4 < 1 ? WARM_WINDOW : WINDOW,
        0,
        y,
        -4.58,
        7.5,
        0.5,
        0.08,
      );
    const pad = localBox(
      g,
      0x899d9c,
      7.4,
      40.5,
      -0.8,
      8.5,
      0.7,
      4.2,
      view.cylinder,
    );
    pad.rotation.z = Math.PI / 2;
    localBox(g, 0x384f54, 4.1, 40.5, -0.8, 5, 0.7, 0.8);
  }

  // Ba Son riverfront: several taller glass volumes instead of one generic box.
  for (let i = 0; i < 5; i++) {
    const angle = i * 0.42;
    const point = {
      x: baSon.x + Math.cos(angle) * (i * 5.5),
      z: baSon.z + Math.sin(angle) * (i * 6.5),
    };
    const h = 28 + i * 7 + rng() * 8;
    tower(
      point,
      9 + (i % 2) * 3,
      10,
      h,
      i % 2 ? 0x607b83 : 0x4e6d78,
      -0.18 + i * 0.05,
    );
  }

  // OSM-style outer massing. The supplied Blender generator uses real building
  // footprints and height tags where available, then deterministic category-
  // based heights. Here we retain that low/mid/high rhythm for a lightweight
  // web shell: low-rise west/south, higher offices toward the river.
  const ring = 132;
  for (let i = 0; i < 46; i++) {
    const theta = -Math.PI * 0.95 + (i / 45) * Math.PI * 1.9;
    const radius = ring + (rng() - 0.5) * 24;
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    if (x > 86 && Math.abs(z) < 118) continue;
    const east = Math.max(0, (x + 40) / 180);
    const h = 8 + rng() * 14 + east * (12 + rng() * 24);
    const w = 7 + rng() * 9;
    const d = 8 + rng() * 10;
    const colour = FACADES[Math.floor(rng() * FACADES.length)];
    const g = tower({ x, z }, w, d, h, colour, rng() * 0.14 - 0.07);
    if (h > 26 && rng() < 0.7) {
      localBox(
        g,
        WARM_WINDOW,
        0,
        Math.min(h - 3, 16 + rng() * 8),
        -d / 2 - 0.07,
        w * 0.58,
        0.5,
        0.08,
      );
    }
  }

  // Green fragments break up the skyline and mirror the parks/grass categories
  // queried by the Blender generator.
  for (const [x, z] of [
    [82, -58],
    [84, -43],
    [86, 58],
    [75, 78],
    [-82, 72],
    [-92, 58],
  ]) {
    box(0x758b69, x, 0.04, z, 12, 0.07, 8);
    tree(x - 3, z, 0.72);
    tree(x + 2.5, z + 1.5, 0.85);
  }

  const batch = cityChunks(solid);
  batch.name = "HCMC_OSM_CINEMATIC_SHELL";
  view.root.add(batch);
  view.downtownShell = batch;
  view.downtownProjection = {
    bounds: { south: SOUTH, west: WEST, north: NORTH, east: EAST },
    scale: GAME_SCALE,
    landmarks: { benThanh, nguyenHue, cityHall, bitexco, baSon },
  };
}
