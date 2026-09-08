import * as pc from "playcanvas";

const CAR_PALETTE = [0xb99d79, 0x6c8588, 0xc36f54, 0x4f666c, 0xd0c5ad];
const RIDER_PALETTE = [
  0x3f6f75, 0xd06f47, 0x5e735b, 0xb48a5d, 0x596581,
];
const HELMET_PALETTE = [
  0x202c2d, 0xe5dfcf, 0xc95f43, 0x557477, 0x866c58,
];

function addBox(
  view,
  parent,
  name,
  hex,
  position,
  scale,
  rotation = [0, 0, 0],
  gloss = 0.22,
  metalness = 0.02,
) {
  const entity = view.box(
    name,
    hex,
    scale[0],
    scale[1],
    scale[2],
    gloss,
    metalness,
  );
  entity.setLocalPosition(position[0], position[1], position[2]);
  entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
  parent.addChild(entity);
  return entity;
}

function addPrimitive(
  view,
  parent,
  name,
  type,
  hex,
  position,
  scale,
  rotation = [0, 0, 0],
) {
  const entity = view.primitive(name, type, hex, scale);
  entity.setLocalPosition(position[0], position[1], position[2]);
  entity.setLocalEulerAngles(rotation[0], rotation[1], rotation[2]);
  parent.addChild(entity);
  return entity;
}

function paletteIndex(name, length) {
  let hash = 2166136261;
  for (const char of name)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % length;
}

function buildRider(view, root, name, player) {
  const palette = paletteIndex(name, RIDER_PALETTE.length);
  const jacket = player ? 0xf47d48 : RIDER_PALETTE[palette];
  const helmet = player
    ? 0x252d2d
    : HELMET_PALETTE[(palette + 2) % HELMET_PALETTE.length];
  const skin = 0xd6b18b;

  addBox(
    view,
    root,
    `${name}_RIDER_TORSO`,
    jacket,
    [0, 1.64, -0.11],
    [0.48, 0.7, 0.34],
    [-8, 0, 0],
  );
  addBox(
    view,
    root,
    `${name}_RIDER_HIPS`,
    0x293837,
    [0, 1.28, -0.22],
    [0.46, 0.28, 0.38],
    [-8, 0, 0],
  );

  for (const side of [-1, 1]) {
    addBox(
      view,
      root,
      `${name}_RIDER_UPPER_ARM`,
      jacket,
      [side * 0.28, 1.72, 0.05],
      [0.13, 0.48, 0.13],
      [-34, 0, side * 18],
    );
    addBox(
      view,
      root,
      `${name}_RIDER_FOREARM`,
      skin,
      [side * 0.31, 1.47, 0.28],
      [0.11, 0.42, 0.11],
      [-48, 0, side * 8],
    );
    addBox(
      view,
      root,
      `${name}_RIDER_THIGH`,
      0x293837,
      [side * 0.18, 1.03, -0.05],
      [0.18, 0.52, 0.2],
      [-22, 0, side * 9],
    );
    addBox(
      view,
      root,
      `${name}_RIDER_SHIN`,
      0x263331,
      [side * 0.2, 0.78, 0.19],
      [0.15, 0.48, 0.16],
      [18, 0, side * 3],
    );
    addBox(
      view,
      root,
      `${name}_RIDER_SHOE`,
      0x171f1f,
      [side * 0.21, 0.58, 0.38],
      [0.18, 0.12, 0.34],
      [0, 0, 0],
    );
  }

  addPrimitive(
    view,
    root,
    `${name}_RIDER_HEAD`,
    "sphere",
    skin,
    [0, 2.13, 0.01],
    [0.21, 0.24, 0.21],
  );
  addPrimitive(
    view,
    root,
    `${name}_RIDER_HELMET`,
    "sphere",
    helmet,
    [0, 2.23, 0],
    [0.245, 0.2, 0.245],
  );
  addBox(
    view,
    root,
    `${name}_RIDER_VISOR`,
    0x344c50,
    [0, 2.2, 0.205],
    [0.28, 0.09, 0.035],
    [-10, 0, 0],
    0.55,
    0.04,
  );
}

function buildScooter(view, name, hex) {
  const root = new pc.Entity(name);
  const player = name === "PLAYER";

  addBox(
    view,
    root,
    `${name}_FRAME`,
    0x273735,
    [0, 0.47, -0.05],
    [0.42, 0.16, 1.18],
    [0, 0, 0],
    0.28,
    0.12,
  );
  addBox(
    view,
    root,
    `${name}_BODY`,
    hex,
    [0, 0.69, -0.08],
    [0.58, 0.46, 1.08],
    [0, 0, 0],
    0.38,
    0.08,
  );
  addBox(
    view,
    root,
    `${name}_FLOORBOARD`,
    0x283837,
    [0, 0.57, 0.18],
    [0.5, 0.12, 0.66],
  );
  addBox(
    view,
    root,
    `${name}_FRONT_FAIRING`,
    hex,
    [0, 0.92, 0.46],
    [0.51, 0.66, 0.34],
    [-8, 0, 0],
    0.38,
    0.08,
  );
  addBox(
    view,
    root,
    `${name}_SEAT`,
    0x1e2929,
    [0, 1.03, -0.31],
    [0.5, 0.18, 0.72],
    [-2, 0, 0],
    0.3,
    0.02,
  );

  for (const z of [-0.58, 0.6]) {
    addPrimitive(
      view,
      root,
      `${name}_WHEEL`,
      "cylinder",
      0x151d1e,
      [0, 0.34, z],
      [0.29, 0.1, 0.29],
      [0, 0, 90],
    );
    addPrimitive(
      view,
      root,
      `${name}_WHEEL_HUB`,
      "cylinder",
      0x8a9189,
      [0, 0.34, z],
      [0.12, 0.115, 0.12],
      [0, 0, 90],
    );
  }

  addPrimitive(
    view,
    root,
    `${name}_STEERING_STEM`,
    "cylinder",
    0x343f3d,
    [0, 1.22, 0.48],
    [0.045, 0.35, 0.045],
    [-12, 0, 0],
  );
  addBox(
    view,
    root,
    `${name}_HANDLEBAR`,
    0x263432,
    [0, 1.5, 0.42],
    [0.68, 0.055, 0.055],
  );
  addBox(
    view,
    root,
    `${name}_HEADLIGHT`,
    0xf2d6a2,
    [0, 1.03, 0.66],
    [0.28, 0.18, 0.06],
    [-8, 0, 0],
    0.72,
    0.02,
  );
  addBox(
    view,
    root,
    `${name}_TAIL_LIGHT`,
    0xc5523f,
    [0, 0.79, -0.67],
    [0.26, 0.13, 0.05],
    [0, 0, 0],
    0.5,
    0.02,
  );
  addBox(
    view,
    root,
    `${name}_PLATE`,
    0xd8d4c7,
    [0, 0.62, -0.72],
    [0.24, 0.14, 0.035],
    [-8, 0, 0],
  );
  addPrimitive(
    view,
    root,
    `${name}_EXHAUST`,
    "cylinder",
    0x4c5552,
    [-0.28, 0.48, -0.42],
    [0.07, 0.34, 0.07],
    [90, 0, 0],
  );

  for (const side of [-1, 1]) {
    addBox(
      view,
      root,
      `${name}_MIRROR_STALK`,
      0x394643,
      [side * 0.23, 1.6, 0.4],
      [0.035, 0.24, 0.035],
      [0, 0, side * 24],
    );
    addPrimitive(
      view,
      root,
      `${name}_MIRROR`,
      "sphere",
      0x52696a,
      [side * 0.32, 1.79, 0.39],
      [0.09, 0.075, 0.04],
    );
  }

  buildRider(view, root, name, player);
  view.vehicleVisualPass = "procedural-scooter-v2";
  return root;
}

function buildCar(view, index) {
  const root = new pc.Entity(`TRAFFIC_CAR_${index}`);
  const hex = CAR_PALETTE[index % CAR_PALETTE.length];

  addBox(
    view,
    root,
    `TRAFFIC_CAR_${index}_BODY`,
    hex,
    [0, 0.62, 0],
    [1.66, 0.78, 3.15],
    [0, 0, 0],
    0.42,
    0.14,
  );
  addBox(
    view,
    root,
    `TRAFFIC_CAR_${index}_CABIN`,
    hex,
    [0, 1.19, -0.16],
    [1.4, 0.68, 1.48],
    [0, 0, 0],
    0.4,
    0.12,
  );
  addBox(
    view,
    root,
    `TRAFFIC_CAR_${index}_WINDSCREEN`,
    0x314d52,
    [0, 1.22, 0.6],
    [1.14, 0.5, 0.055],
    [-13, 0, 0],
    0.68,
    0.02,
  );
  addBox(
    view,
    root,
    `TRAFFIC_CAR_${index}_REAR_GLASS`,
    0x314d52,
    [0, 1.21, -0.9],
    [1.08, 0.46, 0.055],
    [13, 0, 0],
    0.68,
    0.02,
  );

  for (const side of [-1, 1]) {
    for (const z of [-0.92, 0.92]) {
      addPrimitive(
        view,
        root,
        `TRAFFIC_CAR_${index}_WHEEL`,
        "cylinder",
        0x141b1c,
        [side * 0.82, 0.34, z],
        [0.32, 0.14, 0.32],
        [0, 0, 90],
      );
      addPrimitive(
        view,
        root,
        `TRAFFIC_CAR_${index}_HUB`,
        "cylinder",
        0x8d938d,
        [side * 0.83, 0.34, z],
        [0.13, 0.145, 0.13],
        [0, 0, 90],
      );
    }
  }

  for (const side of [-1, 1]) {
    addBox(
      view,
      root,
      `TRAFFIC_CAR_${index}_HEADLIGHT`,
      0xf3ddb1,
      [side * 0.5, 0.67, 1.6],
      [0.3, 0.16, 0.045],
      [0, 0, 0],
      0.72,
      0.02,
    );
    addBox(
      view,
      root,
      `TRAFFIC_CAR_${index}_TAIL_LIGHT`,
      0xb94f3d,
      [side * 0.52, 0.68, -1.6],
      [0.28, 0.16, 0.045],
      [0, 0, 0],
      0.55,
      0.02,
    );
  }

  addBox(
    view,
    root,
    `TRAFFIC_CAR_${index}_FRONT_BUMPER`,
    0x3b4543,
    [0, 0.43, 1.63],
    [1.28, 0.12, 0.08],
  );
  addBox(
    view,
    root,
    `TRAFFIC_CAR_${index}_REAR_BUMPER`,
    0x3b4543,
    [0, 0.43, -1.63],
    [1.28, 0.12, 0.08],
  );

  return root;
}

export function installPlayCanvasVehicleVisualPass(PlayCanvasScene) {
  if (PlayCanvasScene.prototype.__vehicleVisualPassInstalled) return;

  PlayCanvasScene.prototype.makeScooter = function makeScooter(name, hex) {
    return buildScooter(this, name, hex);
  };

  PlayCanvasScene.prototype.makeVehicle = function makeVehicle(index) {
    if (index % 4 === 0) return buildCar(this, index);
    return buildScooter(
      this,
      `TRAFFIC_BIKE_${index}`,
      index % 3 ? 0x6f9991 : 0xc7785c,
    );
  };

  Object.defineProperty(
    PlayCanvasScene.prototype,
    "__vehicleVisualPassInstalled",
    {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    },
  );
}
