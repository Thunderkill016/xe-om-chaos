import * as THREE from "three";
import { CONFIG } from "../game/config.js";
import { BUILDING_RECTS } from "../world/map.js";
import { colouredGeometry, vertexMaterial } from "./batch.js";
import { buildCity } from "./City.js";
import { Effects } from "./Effects.js";
import { makeScooter, StreetLife } from "./Characters.js";
import { MENU_CAMERA, resolveCameraPosition } from "./CameraRig.js";

export class Scene {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.shadowTile = "";
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xc8d1d0);
    this.scene.fog = new THREE.FogExp2(0xbfc9c5, 0.0046);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.2, 400);
    this.scene.add(new THREE.HemisphereLight(0xdde7ff, 0x665244, 1.55));
    this.scene.add(new THREE.AmbientLight(0xffe8d2, 0.2));
    this.sun = new THREE.DirectionalLight(0xffbd78, 4.1);
    this.sun.position.set(-58, 72, -34);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -38,
      right: 38,
      top: 38,
      bottom: -38,
      near: 1,
      far: 130,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.12;
    /** @type {THREE.BoxGeometry} */
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
    this.sphere = new THREE.IcosahedronGeometry(1, 1);
    this.materials = new Map();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.lookAt = new THREE.Vector3();
    this.desired = new THREE.Vector3();
    this.quality = "auto";
    this.reducedMotion = false;
    this.ratio = Math.min(devicePixelRatio, 1.5);
    this.fps = 60;
    this.frameMs = 16.7;
    this.slowSeconds = 0;
    this.performanceSamples = [];
    this.streetLife = [];
    this.steamVents = [];
    this.buildingFootprints = [];
    buildCity(this);
    this.people = new StreetLife(this);
    this.bike = this.makeBike(0xf47d48, true);
    this.scene.add(this.bike);
    const template = this.makeBike(0xa5bfc2, false);
    const car = new THREE.Group();
    this.mesh(car, 0xc7b7a0, 0, 0.85, 0, 2.1, 1.1, 3.5);
    this.mesh(car, 0x55787a, 0, 1.65, -0.25, 1.8, 0.65, 1.8);
    this.mesh(car, 0xdfd6b9, 0, 2, -0.25, 1.9, 0.12, 1.9);
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const w = this.mesh(
          car,
          0x213b3b,
          x,
          0.5,
          z,
          0.43,
          0.25,
          0.43,
          this.cylinder,
        );
        w.rotation.z = Math.PI / 2;
      }
    this.mesh(car, 0xffe5a9, -0.7, 1, 1.8, 0.35, 0.25, 0.05);
    this.mesh(car, 0xffe5a9, 0.7, 1, 1.8, 0.35, 0.25, 0.05);
    const delivery = this.makeBike(0x78a194, false);
    this.mesh(delivery, 0xd1b58a, 0, 1.65, -0.95, 1.4, 1, 1.15);
    const distantBike = new THREE.Group();
    this.mesh(distantBike, 0x789b94, 0, 0.9, 0, 0.65, 0.6, 1.6);
    this.mesh(distantBike, 0x263e3d, 0, 0.4, -0.7, 0.22, 0.7, 0.6);
    this.mesh(distantBike, 0x263e3d, 0, 0.4, 0.7, 0.22, 0.7, 0.6);
    this.mesh(distantBike, 0xd3b491, 0, 1.6, 0, 0.6, 0.8, 0.5);
    this.mesh(distantBike, 0xe9dcb9, 0, 2.2, 0, 0.5, 0.5, 0.5);
    this.trafficMeshes = {};
    for (const [kind, model] of [
      ["bike", template],
      ["car", car],
      ["delivery", delivery],
      ["distantBike", distantBike],
    ]) {
      const mesh = new THREE.InstancedMesh(
        colouredGeometry(model),
        vertexMaterial(),
        CONFIG.trafficCount + CONFIG.rushCount,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.trafficMeshes[String(kind)] = mesh;
    }
    this.trafficBatches = Object.values(this.trafficMeshes);
    this.transform = new THREE.Object3D();
    this.effects = new Effects(this);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcd6d,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(4.7, 5.5, 40),
      ringMaterial,
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.12;
    this.scene.add(this.marker);
    this.pin = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.5),
      new THREE.MeshBasicMaterial({ color: 0xffcd6d }),
    );
    this.scene.add(this.pin);
    this.camera.position.set(
      MENU_CAMERA.position.x,
      MENU_CAMERA.position.y,
      MENU_CAMERA.position.z,
    );
    this.camera.lookAt(
      MENU_CAMERA.target.x,
      MENU_CAMERA.target.y,
      MENU_CAMERA.target.z,
    );
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  material(colour) {
    if (!this.materials.has(colour))
      this.materials.set(
        colour,
        new THREE.MeshStandardMaterial({
          color: colour,
          roughness: 0.72,
          metalness: 0.025,
          flatShading: false,
        }),
      );
    return this.materials.get(colour);
  }
  /**
   * @param {THREE.Object3D} parent
   * @param {number} colour
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} w
   * @param {number} h
   * @param {number} d
   * @param {THREE.BufferGeometry} [geometry]
   * @returns {THREE.Mesh}
   */
  mesh(parent, colour, x, y, z, w, h, d, geometry = this.box) {
    const mesh = new THREE.Mesh(geometry, this.material(colour));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }
  makeBike(colour, player) {
    return makeScooter(this, colour, player);
  }
  resize() {
    const width = window.innerWidth,
      height = window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  setQuality(value) {
    this.quality = value;
    this.renderer.shadowMap.enabled = value !== "low";
    this.renderer.shadowMap.needsUpdate = true;
    this.ratio =
      value === "low"
        ? 0.85
        : Math.min(devicePixelRatio, value === "high" ? 2 : 1.5);
    this.renderer.setPixelRatio(this.ratio);
    this.resize();
  }
  update(run, dt, playing, measuredDt = dt) {
    const p = run.player;
    // Buildings are static. Keep a cached local shadow atlas while moving within
    // a 16-metre tile, then redraw it around the next tile without changing sun angle.
    const shadowX = Math.round(p.x / 16) * 16,
      shadowZ = Math.round(p.z / 16) * 16;
    const shadowTile = shadowX + ":" + shadowZ;
    if (shadowTile !== this.shadowTile) {
      this.shadowTile = shadowTile;
      this.sun.position.set(shadowX - 35, 55, shadowZ - 22);
      this.sun.target.position.set(shadowX, 0, shadowZ);
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.bike.position.set(
      p.x,
      Math.sin(run.time * 16) * Math.min(p.speed * 0.0018, 0.05) +
        Math.sin(p.bounce * 8) * p.bounce * 0.65,
      p.z,
    );
    this.bike.rotation.y = p.angle;
    this.bike.userData.visual.rotation.z =
      p.recovery > 0 ? Math.sin(p.recovery * 18) * 0.65 : p.lean;
    this.bike.userData.passenger.visible = run.missions.phase === "dropoff";
    this.bike.userData.passenger.position.y =
      p.recovery > 0
        ? 0.54 + Math.abs(Math.sin(p.recovery * 12)) * 0.7
        : 0.54 + Math.sin(run.time * 9) * p.speed * 0.001;
    const cullDistance = this.quality === "low" ? 80 : 115;
    for (const chunk of this.root.children[0].children) {
      if (chunk instanceof THREE.Mesh) {
        const sphere = chunk.geometry.boundingSphere;
        chunk.visible =
          !playing ||
          !sphere ||
          sphere.radius > 60 ||
          Math.hypot(sphere.center.x - p.x, sphere.center.z - p.z) <
            cullDistance + sphere.radius;
      }
    }
    // Zero-scale instances still incur vertex work. Pack visible vehicles and set count.
    for (const mesh of this.trafficBatches) mesh.count = 0;
    const forwardX = Math.sin(p.angle),
      forwardZ = Math.cos(p.angle);
    for (const v of run.traffic) {
      const distance = Math.hypot(v.x - p.x, v.z - p.z);
      const ahead = (v.x - p.x) * forwardX + (v.z - p.z) * forwardZ;
      if (!v.active || (playing && (distance > cullDistance || ahead < -25)))
        continue;
      const kind = v.kind === "bike" && distance > 38 ? "distantBike" : v.kind;
      const mesh = this.trafficMeshes[kind];
      this.transform.position.set(v.x, 0, v.z);
      this.transform.rotation.set(0, v.angle, 0);
      this.transform.updateMatrix();
      mesh.setMatrixAt(mesh.count++, this.transform.matrix);
    }
    for (const mesh of this.trafficBatches)
      mesh.instanceMatrix.needsUpdate = true;
    this.effects.update(run, dt);
    this.people.update(run);
    this.bike.userData.passenger.userData.shirt.material.color.set(
      run.missions.passenger.colour,
    );
    const target = run.missions.target;
    this.marker.position.set(target.x, 0.13, target.z);
    this.pin.position.set(target.x, 4 + Math.sin(run.time * 3) * 0.3, target.z);
    this.pin.rotation.y += dt;
    const markerColour = run.missions.phase === "pickup" ? 0xffc668 : 0x85f3c5;
    this.marker.material.color.setHex(markerColour);
    this.pin.material.color.setHex(markerColour);
    if (playing) {
      // Keep the rider visually present at speed instead of pulling the camera far away.
      // Forward look-ahead grows faster than follow distance so traffic remains readable.
      const speedRatio = Math.min(p.speed / CONFIG.boostSpeed, 1);
      const followDistance = 8.9 + speedRatio * 1.9;
      const cameraHeight = 4.9 + speedRatio * 0.8;
      this.desired.set(
        p.x - Math.sin(p.angle) * followDistance,
        cameraHeight,
        p.z - Math.cos(p.angle) * followDistance,
      );
      const resolvedCamera = resolveCameraPosition(
        { x: p.x, z: p.z },
        { x: this.desired.x, z: this.desired.z },
        BUILDING_RECTS,
      );
      this.desired.x = resolvedCamera.x;
      this.desired.z = resolvedCamera.z;
      const blend = 1 - Math.exp(-dt * 6);
      this.camera.position.lerp(this.desired, blend);
      const lookAhead = 12.5 + speedRatio * 8.5;
      this.lookAt.set(
        p.x + Math.sin(p.angle) * lookAhead,
        1,
        p.z + Math.cos(p.angle) * lookAhead,
      );
      this.camera.lookAt(this.lookAt);
      const fov = this.reducedMotion
        ? 52
        : 54 + speedRatio * 8 + (p.boosting ? 2 : 0);
      this.camera.fov += (fov - this.camera.fov) * blend;
      this.camera.updateProjectionMatrix();
      if (!this.reducedMotion && p.recovery > 0) {
        this.camera.position.x += Math.sin(run.time * 65) * p.recovery * 0.18;
      }
    } else {
      this.camera.position.set(
        MENU_CAMERA.position.x,
        MENU_CAMERA.position.y,
        MENU_CAMERA.position.z,
      );
      this.camera.lookAt(
        MENU_CAMERA.target.x,
        MENU_CAMERA.target.y,
        MENU_CAMERA.target.z,
      );
    }
    this.frameMs = this.frameMs * 0.95 + measuredDt * 1000 * 0.05;
    this.fps = 1000 / this.frameMs;
    if (playing) {
      this.slowSeconds =
        this.fps < 42
          ? this.slowSeconds + dt
          : Math.max(0, this.slowSeconds - dt);
      if (this.quality === "auto" && this.slowSeconds > 3 && this.ratio > 0.8) {
        this.ratio = Math.max(0.8, this.ratio - 0.2);
        this.renderer.setPixelRatio(this.ratio);
        this.resize();
        this.slowSeconds = 0;
      }
    }
    // Pixel-ratio changes clear the framebuffer; always render after any resize.
    this.renderer.render(this.scene, this.camera);
  }
}
