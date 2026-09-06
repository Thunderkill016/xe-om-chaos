import * as THREE from "three";
import { colouredGeometry, vertexMaterial } from "./batch.js";

// Shared original silhouettes: ordinary clothes, open-face helmets, step-through
// scooters. No brand-specific vehicle models or caricature costumes.
/** @param {any} view */
export function makePerson(view, colour, seated = false, helmet = false) {
  const root = new THREE.Group();
  const part = (c, x, y, z, w, h, d, geometry = view.box) =>
    view.mesh(root, c, x, y, z, w, h, d, geometry);
  const waist = seated ? 0.78 : 0.97;
  const shirt = part(colour, 0, waist + 0.3, 0, 0.34, 0.43, 0.24, view.sphere);
  shirt.material = shirt.material.clone();
  root.userData.shirt = shirt;
  for (const side of [-1, 1]) {
    part(
      0x334e65,
      side * 0.19,
      seated ? 0.55 : 0.5,
      seated ? 0.24 : 0,
      0.23,
      seated ? 0.45 : 0.86,
      seated ? 0.57 : 0.25,
    );
    part(0xead8b5, side * 0.19, 0.08, seated ? 0.5 : 0.08, 0.24, 0.14, 0.4);
    const arm = part(
      0xd9a67f,
      side * 0.36,
      waist + 0.22,
      seated ? 0.21 : 0,
      0.14,
      0.51,
      0.17,
    );
    arm.rotation.x = seated ? -0.9 : 0.05;
    arm.rotation.z = side * 0.12;
    if (side === 1) root.userData.wave = arm;
  }
  part(0xe2b58e, 0, waist + 0.87, 0.02, 0.24, 0.28, 0.23, view.sphere);
  part(
    helmet ? 0xf2dfb8 : 0x3b3331,
    0,
    waist + 1.05,
    0,
    0.29,
    0.16,
    0.27,
    view.sphere,
  );
  if (helmet) {
    part(0xef8852, 0, waist + 1.13, 0.02, 0.065, 0.06, 0.45);
    part(0x647b84, 0, waist + 0.9, 0.235, 0.38, 0.12, 0.045);
  } else part(0x3b3331, 0, waist + 0.94, -0.15, 0.4, 0.2, 0.16);
  part(0xc88866, 0, waist + 0.84, 0.25, 0.09, 0.09, 0.075);
  return root;
}

/** @param {any} view */
export function makeScooter(view, colour, player = false, parked = false) {
  const root = new THREE.Group(),
    visual = new THREE.Group();
  root.add(visual);
  root.userData.visual = visual;
  const part = (c, x, y, z, w, h, d, g = view.box) =>
    view.mesh(visual, c, x, y, z, w, h, d, g);
  for (const z of [-0.93, 0.96]) {
    const tire = part(0x23323a, 0, 0.45, z, 0.43, 0.22, 0.43, view.cylinder);
    tire.rotation.z = Math.PI / 2;
    const hub = part(0xaeb7b1, 0, 0.45, z, 0.25, 0.24, 0.25, view.cylinder);
    hub.rotation.z = Math.PI / 2;
    const axle = part(0x465963, 0, 0.68, z, 0.13, 0.55, 0.12);
    axle.rotation.x = 0.18;
  }
  part(colour, 0, 0.86, -0.54, 0.48, 0.36, 0.69, view.sphere);
  part(colour, 0, 0.88, 0.92, 0.44, 0.35, 0.4, view.sphere);
  const shield = part(colour, 0, 1.09, 0.67, 0.39, 0.63, 0.19, view.sphere);
  shield.rotation.x = -0.22;
  part(0xe2d2b4, 0, 0.91, 0.52, 0.38, 0.51, 0.06);
  part(0x34444b, 0, 0.55, 0.03, 0.65, 0.13, 1.1);
  part(0x34444b, 0, 1.13, -0.42, 0.41, 0.105, 0.68, view.sphere);
  part(0x65747c, 0.39, 0.39, -0.68, 0.14, 0.16, 0.8);
  part(0xffddb0, 0, 1.61, 0.83, 0.36, 0.23, 0.12, view.sphere);
  part(colour, 0, 1.58, 0.69, 0.53, 0.23, 0.26, view.sphere);
  part(0x33484b, 0, 1.55, 0.51, 1.04, 0.075, 0.08);
  for (const side of [-1, 1]) {
    const stem = part(0x5b7379, side * 0.51, 1.78, 0.52, 0.045, 0.48, 0.045);
    stem.rotation.z = -side * 0.3;
    part(0xb3cfcc, side * 0.58, 2.02, 0.51, 0.16, 0.1, 0.06, view.sphere);
  }
  part(0xee674d, 0, 0.91, -1.14, 0.4, 0.16, 0.08);
  part(0xede5d2, 0, 0.61, -1.16, 0.32, 0.26, 0.035);
  for (const side of [-1, 1])
    part(0xf4b757, side * 0.32, 0.92, -1.05, 0.12, 0.1, 0.1);
  if (!parked) {
    const rider = makePerson(view, player ? 0xeaa767 : colour, true, true);
    rider.position.set(0, 0.5, 0.1);
    visual.add(rider);
  }
  const body = new THREE.Mesh(colouredGeometry(visual), vertexMaterial());
  body.receiveShadow = true;
  visual.clear();
  visual.add(body);
  const passenger = makePerson(view, 0x85aaa8, true, true);
  const shirt = passenger.userData.shirt;
  passenger.remove(shirt);
  const passengerBody = new THREE.Mesh(
    colouredGeometry(passenger),
    vertexMaterial(),
  );
  passenger.clear();
  passenger.add(passengerBody, shirt);
  passenger.position.set(0, 0.54, -0.78);
  passenger.visible = false;
  visual.add(passenger);
  root.userData.passenger = passenger;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 16),
    new THREE.MeshBasicMaterial({
      color: 0x233e40,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.9, 1.65, 1);
  shadow.position.y = 0.1;
  root.add(shadow);
  if (parked) visual.rotation.z = 0.13;
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      // Moving riders use contact blobs; the expensive city shadow map can be cached.
      node.castShadow = false;
      node.receiveShadow = true;
    }
  });
  return root;
}

export class StreetLife {
  constructor(view) {
    this.view = view;
    this.transform = new THREE.Object3D();
    this.batches = [false, true].map((seated) => {
      const mesh = new THREE.InstancedMesh(
        colouredGeometry(
          makePerson(view, seated ? 0xe5b781 : 0x85adae, seated),
        ),
        vertexMaterial(),
        64,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      view.scene.add(mesh);
      return mesh;
    });
    this.waiting = makePerson(view, 0xeab76e, false, true);
    view.scene.add(this.waiting);
  }
  update(run) {
    for (const mesh of this.batches) mesh.count = 0;
    for (const [i, person] of this.view.streetLife.entries()) {
      if (Math.hypot(person.x - run.player.x, person.z - run.player.z) > 70)
        continue;
      const mesh = this.batches[person.seated ? 1 : 0];
      this.transform.position.set(person.x, person.seated ? 0.35 : 0, person.z);
      this.transform.rotation.set(
        0,
        person.angle + Math.sin(run.time * 0.7 + i) * 0.08,
        0,
      );
      this.transform.updateMatrix();
      mesh.setMatrixAt(mesh.count++, this.transform.matrix);
    }
    for (const mesh of this.batches) mesh.instanceMatrix.needsUpdate = true;
    this.waiting.visible = run.missions.phase === "pickup";
    this.waiting.position.set(
      run.missions.pickup.x + 1.8,
      0,
      run.missions.pickup.z,
    );
    this.waiting.rotation.y = Math.atan2(
      run.player.x - this.waiting.position.x,
      run.player.z - this.waiting.position.z,
    );
    this.waiting.userData.wave.rotation.z = -2.3 + Math.sin(run.time * 6) * 0.3;
    this.waiting.userData.shirt.material.color.set(
      run.missions.passenger.colour,
    );
  }
}
