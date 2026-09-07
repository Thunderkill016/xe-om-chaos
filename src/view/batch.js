import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { random } from "../game/config.js";

/** Bake original primitive geometry with vertex colours; source geometry remains reusable. */
export function colouredGeometry(root) {
  root.updateMatrixWorld(true);
  const geometries = [];
  root.traverseVisible((node) => {
    if (
      !(node instanceof THREE.Mesh) ||
      Array.isArray(node.material) ||
      node.material.transparent
    )
      return;
    const geometry = (
      node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone()
    ).applyMatrix4(node.matrixWorld);
    const vertices = geometry.attributes.position.count;
    const rgb = new Float32Array(vertices * 3);
    const colour = node.material.color;
    const previousColour = node.material.vertexColors
      ? geometry.attributes.color
      : undefined;
    for (let i = 0; i < vertices; i++) {
      rgb[i * 3] = colour.r * (previousColour?.getX(i) ?? 1);
      rgb[i * 3 + 1] = colour.g * (previousColour?.getY(i) ?? 1);
      rgb[i * 3 + 2] = colour.b * (previousColour?.getZ(i) ?? 1);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
    geometries.push(geometry);
  });
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!merged) throw new Error("Geometry batch could not be created");
  return merged;
}
export const vertexMaterial = () =>
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.76,
    metalness: 0.02,
    flatShading: false,
  });

// Horizontal surfaces sample an unpainted patch of the shared plaster map.
// Otherwise a 178m road stretches facade streaks into what looks like wood grain.
const NEUTRAL_UV = 0.99;
export function cityGeometry(root) {
  const geometry = colouredGeometry(root);
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < normal.count; i++)
    if (Math.abs(normal.getY(i)) > 0.9) uv.setXY(i, NEUTRAL_UV, NEUTRAL_UV);
  return geometry;
}

export function cityChunks(root) {
  const groups = new Map(),
    output = new THREE.Group();
  // A block-sized batch keeps buildings cheap while restoring frustum culling.
  const chunkSize = 36;
  for (const child of [...root.children]) {
    const key =
      Math.floor(child.position.x / chunkSize) +
      ":" +
      Math.floor(child.position.z / chunkSize);
    if (!groups.has(key)) groups.set(key, new THREE.Group());
    groups.get(key).add(child);
  }
  const material = vertexMaterial();
  // One neutral plaster/grain map modulates baked vertex colours. It adds broad
  // weathering without unique facade images, per-building materials or network assets.
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("City texture requires Canvas 2D");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 256, 256);
  const rng = random("saigon-plaster");
  for (let i = 0; i < 3500; i++) {
    context.fillStyle = `rgba(75,70,60,${rng() * 0.08})`;
    context.fillRect(rng() * 256, rng() * 256, 1 + rng() * 3, 1 + rng() * 3);
  }
  for (let i = 0; i < 25; i++) {
    const x = rng() * 256;
    const fade = context.createLinearGradient(0, 0, 0, 110 + rng() * 130);
    fade.addColorStop(0, "rgba(50,55,45,.09)");
    fade.addColorStop(1, "rgba(50,55,45,0)");
    context.fillStyle = fade;
    context.fillRect(x, 0, 2 + rng() * 7, 256);
  }
  // Keep the lower-right 8px neutral, including a filtering margin around 0.99.
  context.fillStyle = "#ffffff";
  context.fillRect(248, 248, 8, 8);
  material.map = new THREE.CanvasTexture(canvas);
  material.map.colorSpace = THREE.SRGBColorSpace;
  for (const group of groups.values()) {
    const geo = cityGeometry(group);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    output.add(mesh);
  }
  return output;
}
