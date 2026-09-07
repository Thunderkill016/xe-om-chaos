import * as pc from "playcanvas";
import { CONFIG } from "../game/config.js";
import {
  REAL_HCM_CORRIDOR,
  REAL_HCM_CORRIDOR_BUILDINGS,
  SAIGON_VERTICAL_SLICE,
} from "../world/HcmCorridor.js";

const DEG = 180 / Math.PI;

function colour(hex) {
  return new pc.Color(
    ((hex >> 16) & 255) / 255,
    ((hex >> 8) & 255) / 255,
    (hex & 255) / 255,
  );
}

function segmentFrame(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.max(0.001, Math.hypot(dx, dz));
  return {
    dx,
    dz,
    length,
    angle: Math.atan2(dx, dz),
    nx: -dz / length,
    nz: dx / length,
  };
}

export class PlayCanvasScene {
  constructor(canvas) {
    this.rendererKind = "playcanvas";
    this.canvas = canvas;
    this.quality = "auto";
    this.reducedMotion = false;
    this.ratio = Math.min(devicePixelRatio, 1.5);
    this.fps = 60;
    this.frameMs = 16.7;
    this.materials = new Map();
    this.effects = { particleLife: [] };
    this.renderer = {
      info: { render: { calls: 0, triangles: 0 } },
      shadowMap: { needsUpdate: false },
    };

    this.app = new pc.Application(canvas);
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.ambientLight = new pc.Color(0.43, 0.47, 0.45);

    this.world = new pc.Entity("SAIGON_WORLD");
    this.app.root.addChild(this.world);

    this.camera = new pc.Entity("CHASE_CAMERA");
    this.camera.addComponent("camera", {
      clearColor: new pc.Color(0.67, 0.75, 0.78),
      farClip: 450,
      nearClip: 0.15,
      fov: 54,
    });
    this.app.root.addChild(this.camera);

    this.sun = new pc.Entity("SAIGON_SUN");
    this.sun.addComponent("light", {
      type: "directional",
      color: new pc.Color(1, 0.77, 0.53),
      intensity: 2.6,
      castShadows: true,
      shadowResolution: 1024,
    });
    this.sun.setEulerAngles(48, -36, 0);
    this.app.root.addChild(this.sun);

    this.player = this.makeScooter("PLAYER", 0xf47d48);
    this.app.root.addChild(this.player);
    this.traffic = [];
    for (let index = 0; index < CONFIG.trafficCount + CONFIG.rushCount; index++) {
      const entity = this.makeVehicle(index);
      entity.enabled = false;
      this.app.root.addChild(entity);
      this.traffic.push(entity);
    }

    this.marker = this.box("MISSION_MARKER", 0xffc668, 1.3, 0.08, 1.3);
    this.marker.setPosition(0, 0.16, 0);
    this.app.root.addChild(this.marker);

    this.buildSaigonVerticalSlice();
    this.realHcmCorridorStats = {
      id: REAL_HCM_CORRIDOR.id,
      source: REAL_HCM_CORRIDOR.source,
      sourceType: REAL_HCM_CORRIDOR.sourceType,
      sourceLength: REAL_HCM_CORRIDOR.sourceLength,
      gameLength: REAL_HCM_CORRIDOR.length,
      buildings: REAL_HCM_CORRIDOR_BUILDINGS.length,
      renderer: "PlayCanvas 2",
      verticalSlice: SAIGON_VERTICAL_SLICE.name,
    };

    const menuStart = REAL_HCM_CORRIDOR.points[0];
    const menuNext = REAL_HCM_CORRIDOR.points[1];
    const menuFrame = segmentFrame(menuStart, menuNext);
    this.menuCamera = {
      x: menuStart.x - menuFrame.dx / menuFrame.length * 13,
      y: 6.2,
      z: menuStart.z - menuFrame.dz / menuFrame.length * 13,
      tx: menuStart.x + menuFrame.dx / menuFrame.length * 22,
      ty: 1.7,
      tz: menuStart.z + menuFrame.dz / menuFrame.length * 22,
    };
    this.camera.setPosition(this.menuCamera.x, this.menuCamera.y, this.menuCamera.z);
    this.camera.lookAt(this.menuCamera.tx, this.menuCamera.ty, this.menuCamera.tz);

    this.app.start();
    window.addEventListener("resize", () => this.resize());
  }

  material(hex, gloss = 0.22, metalness = 0.02) {
    const key = `${hex}:${gloss}:${metalness}`;
    if (this.materials.has(key)) return this.materials.get(key);
    const material = new pc.StandardMaterial();
    material.diffuse = colour(hex);
    material.gloss = gloss;
    material.metalness = metalness;
    material.useMetalness = true;
    material.update();
    this.materials.set(key, material);
    return material;
  }

  box(name, hex, w, h, d, gloss = 0.2, metalness = 0.02) {
    const entity = new pc.Entity(name);
    entity.addComponent("render", {
      type: "box",
      material: this.material(hex, gloss, metalness),
      castShadows: true,
      receiveShadows: true,
    });
    entity.setLocalScale(w, h, d);
    return entity;
  }

  primitive(name, type, hex, scale) {
    const entity = new pc.Entity(name);
    entity.addComponent("render", {
      type,
      material: this.material(hex),
      castShadows: true,
      receiveShadows: true,
    });
    entity.setLocalScale(scale[0], scale[1], scale[2]);
    return entity;
  }

  addBox(parent, name, hex, x, y, z, w, h, d, angle = 0) {
    const entity = this.box(name, hex, w, h, d);
    entity.setPosition(x, y, z);
    entity.setEulerAngles(0, angle * DEG, 0);
    parent.addChild(entity);
    return entity;
  }

  roadRibbon(a, b, width, hex, y, height = 0.08, lateral = 0) {
    const frame = segmentFrame(a, b);
    const x = (a.x + b.x) * 0.5 + frame.nx * lateral;
    const z = (a.z + b.z) * 0.5 + frame.nz * lateral;
    return this.addBox(
      this.world,
      "LE_LOI_SURFACE",
      hex,
      x,
      y,
      z,
      width,
      height,
      frame.length + 0.25,
      frame.angle,
    );
  }

  buildSaigonVerticalSlice() {
    const road = REAL_HCM_CORRIDOR;
    for (let index = 1; index < road.points.length; index++) {
      const a = road.points[index - 1];
      const b = road.points[index];
      const frame = segmentFrame(a, b);
      this.roadRibbon(a, b, road.shoulderWidth + 11, 0x8a8271, 0.015, 0.04);
      this.roadRibbon(a, b, road.width, 0x292f33, 0.09, 0.1);
      const walkOffset = road.width * 0.5 + 1.25;
      this.roadRibbon(a, b, 2.2, 0xb6aa92, 0.13, 0.14, walkOffset);
      this.roadRibbon(a, b, 2.2, 0xb6aa92, 0.13, 0.14, -walkOffset);
      for (let distance = 4; distance < frame.length; distance += 8) {
        const t = distance / frame.length;
        const mark = this.box("LE_LOI_LANE_MARK", 0xe8ddbd, 0.12, 0.025, 2.5);
        mark.setPosition(a.x + frame.dx * t, 0.16, a.z + frame.dz * t);
        mark.setEulerAngles(0, frame.angle * DEG, 0);
        this.world.addChild(mark);
      }
    }

    this.buildStreetWalls();
    this.buildBenThanhLandmark();
    this.buildNguyenHueEnd();
    this.buildStreetFurniture();
  }

  buildStreetWalls() {
    const road = REAL_HCM_CORRIDOR;
    for (let distance = 9, block = 0; distance < road.length - 8; distance += 10, block++) {
      const point = this.sampleRoad(distance);
      for (const side of [-1, 1]) {
        if (block < 2 && side < 0) continue;
        const setback = road.shoulderWidth * 0.5 + 4.5 + (block % 3) * 0.45;
        const width = 6.5 + (block % 2) * 2;
        const height = 7 + (block % 4) * 2.4;
        const x = point.x + point.nx * setback * side;
        const z = point.z + point.nz * setback * side;
        const group = new pc.Entity(`LE_LOI_SHOPHOUSE_${block}_${side}`);
        group.setPosition(x, 0, z);
        group.setEulerAngles(0, point.angle * DEG, 0);
        this.world.addChild(group);

        const palette = [0xd0b991, 0xc98c73, 0xa4aa95, 0xd8c9aa, 0x829b9e];
        const shell = this.box("FACADE", palette[(block + (side > 0 ? 2 : 0)) % palette.length], width, height, 4.8);
        shell.setLocalPosition(0, height * 0.5, 0);
        group.addChild(shell);

        const shop = this.box("SHOP_GLASS", 0x41666a, width * 0.74, 2.05, 0.16, 0.42, 0.02);
        shop.setLocalPosition(0, 1.35, -2.48 * side);
        group.addChild(shop);
        const sign = this.box("VIETNAMESE_SHOP_SIGN", block % 2 ? 0xd96f47 : 0x3f7471, width * 0.58, 0.55, 0.18);
        sign.setLocalPosition(0, 2.95, -2.52 * side);
        group.addChild(sign);
        const awning = this.box("SHOP_AWNING", block % 3 ? 0xd59b63 : 0x76927d, width * 0.7, 0.12, 0.72);
        awning.setLocalPosition(0, 2.5, -2.76 * side);
        group.addChild(awning);
        for (let y = 4.35; y < height - 0.8; y += 2.7) {
          const windows = this.box("FACADE_WINDOWS", 0x78989b, width * 0.56, 0.58, 0.12, 0.5, 0.01);
          windows.setLocalPosition(0, y, -2.47 * side);
          group.addChild(windows);
        }
      }
    }
  }

  buildBenThanhLandmark() {
    const start = this.sampleRoad(1.5);
    const side = -1;
    const setback = REAL_HCM_CORRIDOR.shoulderWidth * 0.5 + 12;
    const x = start.x + start.nx * setback * side;
    const z = start.z + start.nz * setback * side;
    const market = new pc.Entity("CHO_BEN_THANH");
    market.setPosition(x, 0, z);
    market.setEulerAngles(0, start.angle * DEG, 0);
    this.world.addChild(market);

    const hall = this.box("BEN_THANH_HALL", 0xd8c08e, 23, 5.2, 15);
    hall.setLocalPosition(0, 2.6, 0);
    market.addChild(hall);
    const roof = this.primitive("BEN_THANH_ROOF", "cone", 0xb86e4c, [12.8, 3.4, 8.4]);
    roof.setLocalPosition(0, 6.2, 0);
    roof.setLocalEulerAngles(0, 45, 0);
    market.addChild(roof);

    const tower = this.box("BEN_THANH_CLOCK_TOWER", 0xe0c99a, 5.2, 9.4, 5.2);
    tower.setLocalPosition(0, 7.2, -8.3);
    market.addChild(tower);
    const towerRoof = this.primitive("BEN_THANH_TOWER_ROOF", "cone", 0xa85d43, [4.2, 3.2, 4.2]);
    towerRoof.setLocalPosition(0, 13.45, -8.3);
    market.addChild(towerRoof);
    const clock = this.primitive("BEN_THANH_CLOCK", "cylinder", 0xf2e6c7, [1.1, 0.12, 1.1]);
    clock.setLocalPosition(0, 9.3, -10.94);
    clock.setLocalEulerAngles(90, 0, 0);
    market.addChild(clock);
    for (const xLocal of [-8.2, -4.1, 4.1, 8.2]) {
      const arch = this.box("BEN_THANH_ENTRANCE", 0x3f6260, 2.7, 2.6, 0.18);
      arch.setLocalPosition(xLocal, 1.65, -7.55);
      market.addChild(arch);
    }
  }

  buildNguyenHueEnd() {
    const end = this.sampleRoad(Math.max(0, REAL_HCM_CORRIDOR.length - 1));
    const plaza = this.box("NGUYEN_HUE_PLAZA", 0xaaa38e, 28, 0.06, 30);
    plaza.setPosition(end.x + end.tx * 11, 0.04, end.z + end.tz * 11);
    plaza.setEulerAngles(0, end.angle * DEG, 0);
    this.world.addChild(plaza);

    for (const side of [-1, 1]) {
      const row = this.box("NGUYEN_HUE_FRONTAGE", side < 0 ? 0xd1c19f : 0x627b82, 9, 18, 10);
      row.setPosition(
        end.x + end.tx * 14 + end.nx * side * 15,
        9,
        end.z + end.tz * 14 + end.nz * side * 15,
      );
      row.setEulerAngles(0, end.angle * DEG, 0);
      this.world.addChild(row);
    }

    const cityHall = new pc.Entity("SAIGON_CITY_HALL_SILHOUETTE");
    cityHall.setPosition(end.x + end.tx * 34, 0, end.z + end.tz * 34);
    cityHall.setEulerAngles(0, end.angle * DEG, 0);
    this.world.addChild(cityHall);
    const body = this.box("CITY_HALL_BODY", 0xe2cfaa, 21, 8, 7);
    body.setLocalPosition(0, 4, 0);
    cityHall.addChild(body);
    const centre = this.box("CITY_HALL_CENTRE", 0xe8d6b4, 7, 12, 8);
    centre.setLocalPosition(0, 6, -0.5);
    cityHall.addChild(centre);
    const cupola = this.primitive("CITY_HALL_CUPOLA", "cone", 0x7f8b69, [3.2, 4.5, 3.2]);
    cupola.setLocalPosition(0, 14.1, -0.5);
    cityHall.addChild(cupola);
  }

  buildStreetFurniture() {
    for (let distance = 7, index = 0; distance < REAL_HCM_CORRIDOR.length - 4; distance += 9, index++) {
      const point = this.sampleRoad(distance);
      const side = index % 2 ? 1 : -1;
      const offset = REAL_HCM_CORRIDOR.shoulderWidth * 0.5 + 1.3;
      const x = point.x + point.nx * offset * side;
      const z = point.z + point.nz * offset * side;
      const trunk = this.primitive("STREET_TREE_TRUNK", "cylinder", 0x66503e, [0.16, 1.35, 0.16]);
      trunk.setPosition(x, 1.35, z);
      this.world.addChild(trunk);
      const crown = this.primitive("STREET_TREE_CROWN", "sphere", 0x4d7557, [1.15, 1.45, 1.15]);
      crown.setPosition(x, 3.65, z);
      this.world.addChild(crown);
      if (index % 2 === 0) {
        const lampSide = -side;
        const lx = point.x + point.nx * offset * lampSide;
        const lz = point.z + point.nz * offset * lampSide;
        const pole = this.primitive("STREET_LAMP", "cylinder", 0x425656, [0.09, 2.3, 0.09]);
        pole.setPosition(lx, 2.3, lz);
        this.world.addChild(pole);
        const lamp = this.primitive("STREET_LAMP_WARM", "sphere", 0xf2bc70, [0.19, 0.19, 0.19]);
        lamp.setPosition(lx, 4.7, lz);
        this.world.addChild(lamp);
      }
    }
  }

  sampleRoad(distanceValue) {
    const distance = Math.max(0, Math.min(REAL_HCM_CORRIDOR.length, distanceValue));
    let travelled = 0;
    for (let index = 1; index < REAL_HCM_CORRIDOR.points.length; index++) {
      const a = REAL_HCM_CORRIDOR.points[index - 1];
      const b = REAL_HCM_CORRIDOR.points[index];
      const frame = segmentFrame(a, b);
      if (travelled + frame.length >= distance || index === REAL_HCM_CORRIDOR.points.length - 1) {
        const t = Math.max(0, Math.min(1, (distance - travelled) / frame.length));
        return {
          x: a.x + frame.dx * t,
          z: a.z + frame.dz * t,
          tx: frame.dx / frame.length,
          tz: frame.dz / frame.length,
          nx: frame.nx,
          nz: frame.nz,
          angle: frame.angle,
        };
      }
      travelled += frame.length;
    }
    const end = REAL_HCM_CORRIDOR.points.at(-1);
    return { ...end, tx: 0, tz: 1, nx: -1, nz: 0, angle: 0 };
  }

  makeScooter(name, hex) {
    const root = new pc.Entity(name);
    const body = this.box(`${name}_BODY`, hex, 0.72, 0.55, 1.55, 0.32, 0.08);
    body.setLocalPosition(0, 0.72, 0);
    root.addChild(body);
    const seat = this.box(`${name}_SEAT`, 0x263e3d, 0.52, 0.18, 0.78);
    seat.setLocalPosition(0, 1.08, -0.18);
    root.addChild(seat);
    for (const z of [-0.58, 0.58]) {
      const wheel = this.primitive(`${name}_WHEEL`, "cylinder", 0x1d2a2a, [0.28, 0.1, 0.28]);
      wheel.setLocalPosition(0, 0.34, z);
      wheel.setLocalEulerAngles(0, 0, 90);
      root.addChild(wheel);
    }
    const rider = this.primitive(`${name}_RIDER`, "capsule", 0xd6b18b, [0.42, 0.78, 0.42]);
    rider.setLocalPosition(0, 1.85, -0.08);
    root.addChild(rider);
    return root;
  }

  makeVehicle(index) {
    if (index % 4 === 0) {
      const car = this.box(`TRAFFIC_CAR_${index}`, index % 8 ? 0xb99d79 : 0x6c8588, 1.65, 1.15, 3.15, 0.4, 0.12);
      return car;
    }
    return this.makeScooter(`TRAFFIC_BIKE_${index}`, index % 3 ? 0x6f9991 : 0xc7785c);
  }

  setQuality(value) {
    this.quality = value;
    this.ratio = value === "low" ? 0.85 : Math.min(devicePixelRatio, value === "high" ? 1.75 : 1.35);
    this.resize();
  }

  resize() {
    this.app.resizeCanvas?.();
  }

  update(run, dt, playing, measuredDt = dt) {
    const p = run.player;
    this.player.setPosition(p.x, 0, p.z);
    this.player.setEulerAngles(0, p.angle * DEG, -p.lean * DEG * 0.7);

    for (let index = 0; index < this.traffic.length; index++) {
      const entity = this.traffic[index];
      const vehicle = run.traffic[index];
      if (!vehicle?.active) {
        entity.enabled = false;
        continue;
      }
      entity.enabled = true;
      entity.setPosition(vehicle.x, 0, vehicle.z);
      entity.setEulerAngles(0, vehicle.angle * DEG, 0);
    }

    const target = run.missions.target;
    this.marker.setPosition(target.x, 0.18, target.z);
    const markerMaterial = this.marker.render?.material;
    if (markerMaterial) {
      markerMaterial.diffuse = colour(run.missions.phase === "pickup" ? 0xffc668 : 0x85f3c5);
      markerMaterial.update();
    }

    if (playing) {
      const speedRatio = Math.min(Math.abs(p.speed) / CONFIG.boostSpeed, 1);
      const follow = 8.7 + speedRatio * 2;
      const height = 4.8 + speedRatio * 0.8;
      const cx = p.x - Math.sin(p.angle) * follow;
      const cz = p.z - Math.cos(p.angle) * follow;
      this.camera.setPosition(cx, height, cz);
      const lookAhead = 4 + speedRatio * 17;
      this.camera.lookAt(
        p.x + Math.sin(p.angle) * lookAhead,
        1.2,
        p.z + Math.cos(p.angle) * lookAhead,
      );
      if (this.camera.camera) this.camera.camera.fov = this.reducedMotion ? 52 : 54 + speedRatio * 7;
    } else {
      this.camera.setPosition(this.menuCamera.x, this.menuCamera.y, this.menuCamera.z);
      this.camera.lookAt(this.menuCamera.tx, this.menuCamera.ty, this.menuCamera.tz);
    }

    this.frameMs = this.frameMs * 0.95 + measuredDt * 1000 * 0.05;
    this.fps = 1000 / Math.max(1, this.frameMs);
    this.renderer.info.render.calls = this.world.children.length + this.traffic.filter((entity) => entity.enabled).length;
    this.renderer.info.render.triangles = this.renderer.info.render.calls * 12;
  }
}
