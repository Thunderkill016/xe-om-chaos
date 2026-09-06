import * as THREE from "three";
import { random } from "../game/config.js";
import { colouredGeometry, vertexMaterial } from "./batch.js";

export class Effects {
  constructor(view) {
    this.view = view;
    const scene = view.scene;
    const root = new THREE.Group();
    view.mesh(root, 0xd7b079, 0, 0.9, 0, 8.5, 1.8, 2.5);
    for (let x = -3.5; x <= 3.5; x += 1.5) {
      const stripe = view.mesh(root, 0xc96d48, x, 1, 1.28, 0.5, 1.5, 0.04);
      stripe.rotation.z = -0.3;
    }
    this.barrier = new THREE.Mesh(colouredGeometry(root), vertexMaterial());
    scene.add(this.barrier);
    const bus = new THREE.Group();
    view.mesh(bus, 0xdca758, 0, 1.55, 0, 8, 2.6, 2.8);
    view.mesh(bus, 0x527774, 0, 2.15, 0, 7.6, 1.1, 2.86);
    for (let x = -3.6; x < 4; x += 1.2)
      view.mesh(bus, 0xdca758, x, 2.2, 0, 0.13, 1.2, 2.9);
    view.mesh(bus, 0xe1d4a7, 0, 3, 0, 8.1, 0.25, 2.85);
    for (const x of [-2.5, 2.5])
      for (const z of [-1.35, 1.35]) {
        const w = view.mesh(
          bus,
          0x243e3c,
          x,
          0.65,
          z,
          0.57,
          0.22,
          0.57,
          view.cylinder,
        );
        w.rotation.x = Math.PI / 2;
      }
    this.bus = new THREE.Mesh(colouredGeometry(bus), vertexMaterial());
    scene.add(this.bus);
    this.potholes = Array.from({ length: 3 }, () => {
      const hole = new THREE.Mesh(
        new THREE.CircleGeometry(1.5, 12),
        new THREE.MeshBasicMaterial({ color: 0x344a47 }),
      );
      hole.rotation.x = -Math.PI / 2;
      hole.position.y = 0.12;
      scene.add(hole);
      return hole;
    });
    const floodMat = new THREE.MeshPhongMaterial({
      color: 0x7eb5b0,
      transparent: true,
      opacity: 0.58,
      shininess: 90,
      specular: 0xc1e4d8,
      depthWrite: false,
    });
    this.flood = new THREE.Mesh(new THREE.PlaneGeometry(13, 69), floodMat);
    this.flood.rotation.x = -Math.PI / 2;
    this.flood.position.set(72, 0.18, 53);
    scene.add(this.flood);
    this.rainCount = 380;
    this.rainPositions = new Float32Array(this.rainCount * 6);
    this.rainOffsets = new Float32Array(this.rainCount * 3);
    const rng = random("visual-rain-only");
    for (let i = 0; i < this.rainOffsets.length; i++)
      this.rainOffsets[i] = rng();
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.rainPositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.rain = new THREE.LineSegments(
      rainGeometry,
      new THREE.LineBasicMaterial({
        color: 0xdcefed,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
    );
    this.rain.frustumCulled = false;
    scene.add(this.rain);
    this.particleCount = 70;
    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleLife = new Float32Array(this.particleCount);
    this.particleVelocity = new Float32Array(this.particleCount * 3);
    this.cursor = 0;
    this.lastSpawn = 0;
    this.lastTick = 0;
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.particlePositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({
        color: 0xffdda0,
        size: 0.18,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    );
    this.particles.frustumCulled = false;
    scene.add(this.particles);
    this.sunColour = new THREE.Color(0xb6d4e5);
    this.rainColour = new THREE.Color(0x8caeb0);
    this.nightColour = new THREE.Color(0x536e79);
    this.visualTime = 0;
    const steamTexture = document.createElement("canvas");
    steamTexture.width = 64;
    steamTexture.height = 64;
    const context = steamTexture.getContext("2d");
    if (!context) throw new Error("Steam sprite requires Canvas 2D");
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,246,220,.55)");
    gradient.addColorStop(0.5, "rgba(255,246,220,.2)");
    gradient.addColorStop(1, "rgba(255,246,220,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    this.steamPositions = new Float32Array(64 * 3);
    const steamGeometry = new THREE.BufferGeometry();
    steamGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.steamPositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.steam = new THREE.Points(
      steamGeometry,
      new THREE.PointsMaterial({
        color: 0xfff1da,
        map: new THREE.CanvasTexture(steamTexture),
        size: 1.4,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    this.steam.frustumCulled = false;
    scene.add(this.steam);
  }
  update(run, dt) {
    const { director: d, player: p } = run;
    this.visualTime += dt;
    let steamCount = 0;
    for (const vent of this.view.steamVents) {
      if (Math.hypot(vent.x - p.x, vent.z - p.z) > 50) continue;
      for (let i = 0; i < 6 && steamCount < 64; i++) {
        const phase = (this.visualTime * 0.35 + i / 6) % 1,
          j = steamCount++ * 3;
        this.steamPositions[j] =
          vent.x + Math.sin(i + this.visualTime) * phase * 0.5;
        this.steamPositions[j + 1] = vent.y + phase * 2.4;
        this.steamPositions[j + 2] = vent.z + phase * 0.45;
      }
    }
    this.steam.geometry.setDrawRange(0, steamCount);
    this.steam.geometry.attributes.position.needsUpdate = true;
    if (run.tick < this.lastTick) {
      // Simulation time restarts at zero; visual cooldowns must restart with it.
      this.lastSpawn = 0;
      this.cursor = 0;
      this.particleLife.fill(0);
    }
    this.lastTick = run.tick;
    this.barrier.visible = d.barrier.active;
    this.barrier.position.set(d.barrier.x, 0, d.barrier.z);
    this.bus.visible = d.bus.active;
    this.bus.position.set(d.bus.x, 0, d.bus.z);
    this.potholes.forEach((hole, i) => {
      hole.visible = d.active.has("potholes");
      hole.position.set(d.potholes[i].x, 0.12, d.potholes[i].z);
    });
    this.flood.visible = d.active.has("flood");
    this.rain.visible = run.weather === "rain";
    const night = Math.max(0, (run.time - 95) / 100);
    const colour = this.view.scene.background;
    colour.copy(this.sunColour).lerp(this.nightColour, night);
    if (this.rain.visible) colour.lerp(this.rainColour, 0.7);
    this.view.scene.fog.color.copy(colour);
    this.view.sun.intensity = this.rain.visible ? 1.25 : 3 - night * 1.3;
    if (this.rain.visible) {
      const count = this.view.quality === "low" ? 140 : this.rainCount;
      this.rain.geometry.setDrawRange(0, count * 2);
      for (let i = 0; i < count; i++) {
        const k = i * 6,
          j = i * 3,
          x = p.x + (this.rainOffsets[j] - 0.5) * 70,
          z = p.z + (this.rainOffsets[j + 2] - 0.5) * 70,
          y = (((this.rainOffsets[j + 1] * 35 - run.time * 22) % 35) + 35) % 35;
        this.rainPositions[k] = x;
        this.rainPositions[k + 1] = y;
        this.rainPositions[k + 2] = z;
        this.rainPositions[k + 3] = x + 0.2;
        this.rainPositions[k + 4] = y - 1.8;
        this.rainPositions[k + 5] = z + 0.1;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
    const emitting = p.speed > 12 || p.recovery > 0 || p.bounce > 0;
    if (emitting && run.time - this.lastSpawn > 0.06) {
      this.lastSpawn = run.time;
      const i = this.cursor++ % this.particleCount,
        j = i * 3;
      this.particlePositions[j] = p.x - Math.sin(p.angle);
      this.particlePositions[j + 1] = 0.2;
      this.particlePositions[j + 2] = p.z - Math.cos(p.angle);
      this.particleLife[i] = 0.7;
      this.particleVelocity[j] = Math.sin(i * 7) * 1.6;
      this.particleVelocity[j + 1] = 2;
      this.particleVelocity[j + 2] = Math.cos(i * 3) * 1.6;
    }
    for (let i = 0; i < this.particleCount; i++) {
      const j = i * 3;
      this.particleLife[i] -= dt;
      if (this.particleLife[i] > 0) {
        this.particlePositions[j] += this.particleVelocity[j] * dt;
        this.particlePositions[j + 1] += this.particleVelocity[j + 1] * dt;
        this.particlePositions[j + 2] += this.particleVelocity[j + 2] * dt;
        this.particleVelocity[j + 1] -= 5 * dt;
      } else this.particlePositions[j + 1] = -5;
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.particles.material.color.setHex(
      this.rain.visible ? 0xc7eae3 : 0xffdda0,
    );
  }
}
