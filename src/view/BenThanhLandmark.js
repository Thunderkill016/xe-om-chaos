import * as pc from "playcanvas";
import { REAL_HCM_CORRIDOR } from "../world/HcmCorridor.js";

const DEG = 180 / Math.PI;

function pitchedRoof(view, parent, name, hex, width, depth, y, z = 0) {
  const pitch = 18;
  const panelDepth = depth * 0.56;
  for (const side of [-1, 1]) {
    const panel = view.box(
      `${name}_${side < 0 ? "FRONT" : "BACK"}`,
      hex,
      width,
      0.22,
      panelDepth,
      0.28,
      0.02,
    );
    panel.setLocalPosition(0, y, z + side * depth * 0.23);
    panel.setLocalEulerAngles(side < 0 ? pitch : -pitch, 0, 0);
    parent.addChild(panel);
  }

  const ridge = view.box(`${name}_RIDGE`, 0x7e4636, width + 0.25, 0.18, 0.26);
  ridge.setLocalPosition(0, y + 0.82, z);
  parent.addChild(ridge);
}

function addClock(view, tower) {
  const face = view.primitive(
    "BEN_THANH_CLOCK_FACE",
    "cylinder",
    0xf1e4c5,
    [1.18, 0.1, 1.18],
  );
  face.setLocalPosition(0, 9.9, -3.16);
  face.setLocalEulerAngles(90, 0, 0);
  tower.addChild(face);

  const handMaterial = 0x273a37;
  const minute = view.box(
    "BEN_THANH_CLOCK_MINUTE",
    handMaterial,
    0.11,
    0.72,
    0.08,
  );
  minute.setLocalPosition(0, 10.12, -3.29);
  tower.addChild(minute);
  const hour = view.box("BEN_THANH_CLOCK_HOUR", handMaterial, 0.58, 0.11, 0.08);
  hour.setLocalPosition(0.22, 9.9, -3.3);
  tower.addChild(hour);

  for (const x of [-0.82, 0.82]) {
    const slit = view.box("BEN_THANH_CLOCK_VENT", 0x6e684f, 0.22, 0.74, 0.08);
    slit.setLocalPosition(x, 7.55, -3.25);
    tower.addChild(slit);
  }
}

function addFrontArcade(view, market) {
  const openingColour = 0x294b47;
  const stucco = 0xd9c08c;
  const openingXs = [-11.2, -8.1, -5, 5, 8.1, 11.2];

  for (const x of openingXs) {
    const opening = view.box(
      "BEN_THANH_ARCADE_OPENING",
      openingColour,
      2.35,
      2.55,
      0.18,
      0.32,
      0.02,
    );
    opening.setLocalPosition(x, 1.62, -7.62);
    market.addChild(opening);

    const transom = view.box(
      "BEN_THANH_ARCADE_TRANSOM",
      0xb28c62,
      2.15,
      0.16,
      0.2,
    );
    transom.setLocalPosition(x, 2.63, -7.74);
    market.addChild(transom);
  }

  for (const x of [-12.7, -9.65, -6.55, -3.45, 3.45, 6.55, 9.65, 12.7]) {
    const column = view.box(
      "BEN_THANH_ARCADE_COLUMN",
      stucco,
      0.32,
      3.65,
      0.38,
    );
    column.setLocalPosition(x, 1.82, -7.72);
    market.addChild(column);
  }

  const fascia = view.box("BEN_THANH_FRONT_FASCIA", 0xc7a974, 27.5, 0.42, 0.34);
  fascia.setLocalPosition(0, 3.62, -7.7);
  market.addChild(fascia);
}

function addTower(view, market) {
  const tower = new pc.Entity("BEN_THANH_CLOCK_TOWER");
  tower.setLocalPosition(0, 0, -8.35);
  market.addChild(tower);

  const lower = view.box("BEN_THANH_TOWER_LOWER", 0xd9c08c, 6.1, 6.1, 5.8);
  lower.setLocalPosition(0, 3.05, 0);
  tower.addChild(lower);

  const upper = view.box("BEN_THANH_TOWER_UPPER", 0xdfc99b, 4.85, 5.1, 5.45);
  upper.setLocalPosition(0, 8.35, 0.08);
  tower.addChild(upper);

  for (const x of [-2.62, 2.62]) {
    const pilaster = view.box(
      "BEN_THANH_TOWER_PILASTER",
      0xb99c6d,
      0.34,
      10.9,
      0.42,
    );
    pilaster.setLocalPosition(x, 5.45, -2.83);
    tower.addChild(pilaster);
  }

  const portal = view.box(
    "BEN_THANH_MAIN_GATE",
    0x244843,
    3.5,
    3.85,
    0.22,
    0.4,
    0.02,
  );
  portal.setLocalPosition(0, 2.12, -3.02);
  tower.addChild(portal);

  const gateLintel = view.box(
    "BEN_THANH_GATE_LINTEL",
    0xb18c61,
    4.15,
    0.42,
    0.3,
  );
  gateLintel.setLocalPosition(0, 4.12, -3.09);
  tower.addChild(gateLintel);

  addClock(view, tower);

  pitchedRoof(
    view,
    tower,
    "BEN_THANH_TOWER_ROOF",
    0x964f39,
    6.9,
    5.9,
    11.72,
    0.05,
  );
  const finial = view.primitive(
    "BEN_THANH_TOWER_FINIAL",
    "cylinder",
    0x58483b,
    [0.13, 0.95, 0.13],
  );
  finial.setLocalPosition(0, 13.35, 0.05);
  tower.addChild(finial);
}

function addMarketApron(view, market) {
  const apron = view.box("BEN_THANH_APRON", 0xb7aa8d, 31, 0.06, 7.5);
  apron.setLocalPosition(0, 0.045, -10.9);
  market.addChild(apron);

  for (const x of [-12, -8, -4, 4, 8, 12]) {
    const bollard = view.primitive(
      "BEN_THANH_BOLLARD",
      "cylinder",
      0x5a675f,
      [0.13, 0.45, 0.13],
    );
    bollard.setLocalPosition(x, 0.45, -13.1);
    market.addChild(bollard);
  }
}

export function buildBenThanhLandmark(view) {
  const start = view.sampleRoad(1.5);
  const side = -1;
  const setback = REAL_HCM_CORRIDOR.shoulderWidth * 0.5 + 12.6;
  const x = start.x + start.nx * setback * side;
  const z = start.z + start.nz * setback * side;

  const market = new pc.Entity("CHO_BEN_THANH");
  market.setPosition(x, 0, z);
  market.setEulerAngles(0, (start.angle + Math.PI * 0.5) * DEG, 0);
  view.world.addChild(market);

  const hall = view.box("BEN_THANH_MAIN_HALL", 0xd3b67e, 28.5, 4.7, 15.1);
  hall.setLocalPosition(0, 2.35, 0);
  market.addChild(hall);

  for (const xWing of [-10.8, 10.8]) {
    const wing = view.box("BEN_THANH_SIDE_WING", 0xc9ad78, 7.2, 4.2, 17.8);
    wing.setLocalPosition(xWing, 2.1, 0.8);
    market.addChild(wing);
  }

  pitchedRoof(
    view,
    market,
    "BEN_THANH_MAIN_ROOF",
    0x99543d,
    29.4,
    15.8,
    5.28,
    0,
  );
  addFrontArcade(view, market);
  addTower(view, market);
  addMarketApron(view, market);

  for (const xVent of [-9.2, -6.2, 6.2, 9.2]) {
    const vent = view.box("BEN_THANH_HIGH_VENT", 0x6f745f, 1.55, 0.72, 0.14);
    vent.setLocalPosition(xVent, 4.08, -7.66);
    market.addChild(vent);
  }

  view.benThanhAnchor = {
    x,
    z,
    roadX: start.x,
    roadZ: start.z,
    tx: start.tx,
    tz: start.tz,
    nx: start.nx,
    nz: start.nz,
  };

  return market;
}
