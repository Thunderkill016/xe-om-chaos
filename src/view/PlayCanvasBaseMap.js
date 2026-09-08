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
const SIGN_PALETTE = [0xb64f36, 0x315f61, 0xd29a4f, 0x6d7d61, 0x9f5546];
const AWNING_PALETTE = [0xd28c55, 0x6f8a72, 0xb85e47, 0xc0a068];

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

function nearestAvenue(value) {
  let nearest = AVENUES[0];
  let distance = Math.abs(value - nearest);
  for (const avenue of AVENUES.slice(1)) {
    const candidate = Math.abs(value - avenue);
    if (candidate < distance) {
      nearest = avenue;
      distance = candidate;
    }
  }
  return { value: nearest, distance };
}

function streetFacade(rect) {
  const xRoad = nearestAvenue(rect.x);
  const zRoad = nearestAvenue(rect.z);
  const xGap = Math.max(0, xRoad.distance - rect.w * 0.5);
  const zGap = Math.max(0, zRoad.distance - rect.d * 0.5);
  if (xGap < zGap) {
    return {
      axis: "x",
      side: Math.sign(xRoad.value - rect.x) || 1,
      span: rect.d,
      wall: rect.w * 0.5,
    };
  }
  return {
    axis: "z",
    side: Math.sign(zRoad.value - rect.z) || 1,
    span: rect.w,
    wall: rect.d * 0.5,
  };
}

function facadeBox(
  view,
  building,
  facade,
  name,
  hex,
  along,
  y,
  outward,
  span,
  height,
  depth,
) {
  const entity = view.box(name, hex, 1, height, 1);
  if (facade.axis === "z") {
    entity.setLocalScale(span, height, depth);
    entity.setLocalPosition(
      along,
      y,
      facade.side * (facade.wall + outward),
    );
  } else {
    entity.setLocalScale(depth, height, span);
    entity.setLocalPosition(
      facade.side * (facade.wall + outward),
      y,
      along,
    );
  }
  building.addChild(entity);
  return entity;
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

function addSaigonFacade(view, building, rect, height, seed) {
  const facade = streetFacade(rect);
  const span = Math.max(2.4, facade.span);
  const accent = SIGN_PALETTE[
    Math.floor(hash01(seed + ":sign") * SIGN_PALETTE.length)
  ];
  const awning = AWNING_PALETTE[
    Math.floor(hash01(seed + ":awning") * AWNING_PALETTE.length)
  ];
  const frontage = Math.max(1.9, span * 0.8);

  facadeBox(
    view,
    building,
    facade,
    "SAIGON_SHOP_GLASS",
    0x31585d,
    0,
    1.35,
    0.06,
    frontage,
    2.2,
    0.12,
  );
  facadeBox(
    view,
    building,
    facade,
    "SAIGON_ROLLING_SHUTTER",
    0x56615f,
    -frontage * 0.32,
    1.35,
    0.075,
    frontage * 0.3,
    2.15,
    0.13,
  );
  facadeBox(
    view,
    building,
    facade,
    "SAIGON_SHOP_SIGN",
    accent,
    0,
    3.08,
    0.11,
    Math.max(2.1, span * 0.74),
    0.64,
    0.18,
  );
  facadeBox(
    view,
    building,
    facade,
    "SAIGON_AWNING",
    awning,
    0,
    2.62,
    0.48,
    Math.max(2, span * 0.7),
    0.12,
    0.95,
  );

  let floor = 0;
  for (let y = 4.45; y < height - 0.85; y += 2.6, floor++) {
    const balcony = hash01(`${seed}:balcony:${floor}`) > 0.26;
    if (balcony) {
      facadeBox(
        view,
        building,
        facade,
        "SAIGON_BALCONY_SLAB",
        0xc9b89a,
        0,
        y - 0.72,
        0.42,
        Math.max(2, span * 0.68),
        0.12,
        0.9,
      );
      facadeBox(
        view,
        building,
        facade,
        "SAIGON_BALCONY_RAIL",
        0x3e5554,
        0,
        y - 0.2,
        0.83,
        Math.max(1.8, span * 0.64),
        0.08,
        0.08,
      );
      for (const offset of [-0.28, 0, 0.28]) {
        facadeBox(
          view,
          building,
          facade,
          "SAIGON_BALCONY_BAR",
          0x3e5554,
          offset * span,
          y - 0.45,
          0.83,
          0.045,
          0.58,
          0.045,
        );
      }
    }

    const windowSpan = Math.max(1.45, span * 0.55);
    facadeBox(
      view,
      building,
      facade,
      "SAIGON_UPPER_WINDOW",
      floor % 2 ? 0x52757a : 0x6d8b8d,
      0,
      y,
      0.07,
      windowSpan,
      0.86,
      0.11,
    );

    if ((floor + Math.floor(hash01(seed) * 3)) % 2 === 0) {
      facadeBox(
        view,
        building,
        facade,
        "SAIGON_AC_UNIT",
        0xbfc2b6,
        span * 0.31,
        y + 0.42,
        0.22,
        Math.min(0.72, span * 0.15),
        0.45,
        0.32,
      );
    }
  }

  if (hash01(seed + ":tank") > 0.46) {
    const tank = view.primitive(
      "SAIGON_ROOF_WATER_TANK",
      "cylinder",
      0x5a6d68,
      [0.55, 0.7, 0.55],
    );
    tank.setLocalPosition(span * 0.2, height + 0.72, 0);
    building.addChild(tank);
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

    addSaigonFacade(view, building, rect, height, seed);
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
