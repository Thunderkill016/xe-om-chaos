import * as pc from "playcanvas";
import {
  ALLEYS,
  ALLEY_HALF,
  AVENUES,
  BUILDING_RECTS,
  EXTENT,
  HIDDEN_LANES,
  ROAD_HALF,
  VISIBLE_LOT_RECTS,
} from "../world/map.js";
import {
  REAL_HCM_CORRIDOR,
  realCorridorDistance,
} from "../world/HcmCorridor.js";

const DEG = 180 / Math.PI;
const BUILDING_PALETTE = [
  0xd8c6a3, 0xc98e72, 0x95a69b, 0xe0d2b7, 0x839da1, 0xc77863,
];

function hash01(value) {
  let hash = 2166136261;
  for (const char of String(value))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

function addBox(view, parent, name, hex, x, y, z, w, h, d, angle = 0) {
  const entity = view.box(name, hex, w, h, d);
  entity.setPosition(x, y, z);
  entity.setEulerAngles(0, angle * DEG, 0);
  parent.addChild(entity);
  return entity;
}

function addRibbon(view, parent, name, hex, a, b, width, y, height = 0.08) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const angle = Math.atan2(dx, dz);
  return addBox(
    view,
    parent,
    name,
    hex,
    (a.x + b.x) * 0.5,
    y,
    (a.z + b.z) * 0.5,
    width,
    height,
    length + 0.15,
    angle,
  );
}

function overlapsRealCorridor(rect) {
  const radius = Math.hypot(rect.w, rect.d) * 0.5;
  return (
    realCorridorDistance(rect.x, rect.z) <
    REAL_HCM_CORRIDOR.shoulderWidth * 0.5 + radius + 1.5
  );
}

function addStreetMarkings(view, root) {
  for (const avenue of AVENUES) {
    for (let offset = -80; offset <= 80; offset += 10) {
      if (AVENUES.some((crossing) => Math.abs(offset - crossing) < 10))
        continue;
      addBox(
        view,
        root,
        "BASE_LANE_MARK",
        0xe8ddbd,
        avenue,
        0.15,
        offset,
        0.12,
        0.025,
        3,
      );
      addBox(
        view,
        root,
        "BASE_LANE_MARK",
        0xe8ddbd,
        offset,
        0.15,
        avenue,
        3,
        0.025,
        0.12,
      );
    }
  }

  for (const x of AVENUES)
    for (const z of AVENUES)
      for (const stripe of [-4.5, -1.5, 1.5, 4.5]) {
        addBox(
          view,
          root,
          "BASE_CROSSWALK",
          0xd8d4bd,
          x + stripe,
          0.16,
          z - 6,
          1.4,
          0.025,
          2.1,
        );
        addBox(
          view,
          root,
          "BASE_CROSSWALK",
          0xd8d4bd,
          x - 6,
          0.16,
          z + stripe,
          2.1,
          0.025,
          1.4,
        );
      }
}

function addBuildings(view, root) {
  for (let index = 0; index < BUILDING_RECTS.length; index++) {
    const rect = BUILDING_RECTS[index];
    if (overlapsRealCorridor(rect)) continue;

    const seed = `${rect.x}:${rect.z}:${rect.w}:${rect.d}`;
    const height = 5.8 + hash01(seed) * 8.8;
    const paletteIndex = Math.floor(
      hash01(seed + ":colour") * BUILDING_PALETTE.length,
    );
    const building = new pc.Entity(`BASE_BUILDING_${index}`);
    building.setPosition(rect.x, 0, rect.z);
    root.addChild(building);

    const shell = view.box(
      "BASE_BUILDING_SHELL",
      BUILDING_PALETTE[paletteIndex],
      rect.w,
      height,
      rect.d,
    );
    shell.setLocalPosition(0, height * 0.5, 0);
    building.addChild(shell);

    const roof = view.box(
      "BASE_BUILDING_ROOF",
      0x6f7874,
      rect.w + 0.18,
      0.22,
      rect.d + 0.18,
    );
    roof.setLocalPosition(0, height + 0.11, 0);
    building.addChild(roof);

    const faceZ = rect.z < 0 ? rect.d * 0.5 + 0.055 : -rect.d * 0.5 - 0.055;
    const glass = view.box(
      "BASE_SHOPFRONT",
      0x42666a,
      Math.max(1.8, rect.w * 0.72),
      2.05,
      0.11,
      0.4,
      0.02,
    );
    glass.setLocalPosition(0, 1.35, faceZ);
    building.addChild(glass);

    if (height > 8) {
      for (let y = 4.3; y < height - 1; y += 2.6) {
        const windows = view.box(
          "BASE_WINDOWS",
          0x78989b,
          Math.max(1.6, rect.w * 0.56),
          0.55,
          0.1,
          0.46,
          0.01,
        );
        windows.setLocalPosition(0, y, faceZ);
        building.addChild(windows);
      }
    }
  }
}

export function addAuthoredBaseMap(view) {
  if (view.app.root.findByName("AUTHORED_BASE_MAP")) return;

  const root = new pc.Entity("AUTHORED_BASE_MAP");
  view.world.addChild(root);

  addBox(
    view,
    root,
    "BASE_GROUND",
    0x7f897b,
    0,
    -0.12,
    0,
    EXTENT * 2 + 48,
    0.2,
    EXTENT * 2 + 48,
  );

  for (const lot of VISIBLE_LOT_RECTS)
    addBox(
      view,
      root,
      "BASE_PAVED_LOT",
      0x9da18e,
      lot.x,
      0.015,
      lot.z,
      lot.w,
      0.05,
      lot.d,
    );

  for (const avenue of AVENUES) {
    addBox(
      view,
      root,
      "BASE_AVENUE",
      0x30363a,
      avenue,
      0.09,
      0,
      ROAD_HALF * 2,
      0.1,
      EXTENT * 2,
    );
    addBox(
      view,
      root,
      "BASE_AVENUE",
      0x30363a,
      0,
      0.09,
      avenue,
      EXTENT * 2,
      0.1,
      ROAD_HALF * 2,
    );

    for (const side of [-1, 1]) {
      addBox(
        view,
        root,
        "BASE_SIDEWALK",
        0xb6aa92,
        avenue + side * (ROAD_HALF + 1.65),
        0.11,
        0,
        3.1,
        0.14,
        EXTENT * 2,
      );
      addBox(
        view,
        root,
        "BASE_SIDEWALK",
        0xb6aa92,
        0,
        0.11,
        avenue + side * (ROAD_HALF + 1.65),
        EXTENT * 2,
        0.14,
        3.1,
      );
    }
  }

  for (const alley of ALLEYS) {
    addBox(
      view,
      root,
      "BASE_ALLEY",
      0x676b61,
      alley,
      0.085,
      0,
      ALLEY_HALF * 2,
      0.09,
      144,
    );
    addBox(
      view,
      root,
      "BASE_ALLEY",
      0x676b61,
      0,
      0.085,
      alley,
      144,
      0.09,
      ALLEY_HALF * 2,
    );
  }

  for (const lane of HIDDEN_LANES) {
    const laneRoot = new pc.Entity(
      lane.id === "hem26" ? "HEM_26_PLAYCANVAS" : `HIDDEN_${lane.id}`,
    );
    root.addChild(laneRoot);
    for (let index = 1; index < lane.points.length; index++)
      addRibbon(
        view,
        laneRoot,
        "HIDDEN_LANE_SURFACE",
        0x8e806d,
        lane.points[index - 1],
        lane.points[index],
        lane.width,
        0.11,
        0.1,
      );
  }

  addStreetMarkings(view, root);
  addBuildings(view, root);

  view.authoredBaseMapStats = {
    avenues: AVENUES.length * 2,
    alleys: ALLEYS.length * 2,
    hiddenLanes: HIDDEN_LANES.length,
    buildings: BUILDING_RECTS.length,
    extent: EXTENT,
  };
}
