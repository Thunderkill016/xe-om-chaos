import * as THREE from "three";
import {
  REAL_HCM_CORRIDOR,
  REAL_HCM_BUILDING_CLEARANCE,
  realCorridorBuildingClearance,
} from "../world/HcmCorridor.js";

const LEGACY_VISUAL_CLEARANCE = Math.max(1.2, REAL_HCM_BUILDING_CLEARANCE - 0.4);
const MIN_CARVE_TOP = 0.32;

function worldYaw(parent) {
  parent.updateMatrixWorld(true);
  const quaternion = new THREE.Quaternion();
  parent.getWorldQuaternion(quaternion);
  return new THREE.Euler().setFromQuaternion(quaternion, "YXZ").y;
}

function worldPoint(parent, x, y, z) {
  parent.updateMatrixWorld(true);
  return new THREE.Vector3(x, y, z).applyMatrix4(parent.matrixWorld);
}

function overlapsPlayableCorridor(parent, x, y, z, w, h, d) {
  if (y + h * 0.5 <= MIN_CARVE_TOP) return false;
  const point = worldPoint(parent, x, y, z);
  const scale = new THREE.Vector3();
  parent.getWorldScale(scale);
  const footprint = {
    x: point.x,
    z: point.z,
    w: Math.abs(w * scale.x),
    d: Math.abs(d * scale.z),
    h,
    angle: worldYaw(parent),
    kind: "legacy-city",
  };
  return (
    realCorridorBuildingClearance(footprint) <
    REAL_HCM_CORRIDOR.shoulderWidth * 0.5 + LEGACY_VISUAL_CLEARANCE
  );
}

function carvedMesh(view, colour, geometry) {
  const mesh = new THREE.Mesh(geometry, view.material(colour));
  mesh.visible = false;
  mesh.userData.corridorCarved = true;
  return mesh;
}

export function installLegacyCorridorCarve(SceneClass) {
  const originalMesh = SceneClass.prototype.mesh;
  SceneClass.prototype.mesh = function (
    parent,
    colour,
    x,
    y,
    z,
    w,
    h,
    d,
    geometry = this.box,
  ) {
    if (overlapsPlayableCorridor(parent, x, y, z, w, h, d))
      return carvedMesh(this, colour, geometry);
    return originalMesh.call(this, parent, colour, x, y, z, w, h, d, geometry);
  };

  return (view) => {
    SceneClass.prototype.mesh = originalMesh;
    const required =
      REAL_HCM_CORRIDOR.shoulderWidth * 0.5 + LEGACY_VISUAL_CLEARANCE;
    view.buildingFootprints = view.buildingFootprints.filter(
      (footprint) =>
        realCorridorBuildingClearance({
          x: footprint.x,
          z: footprint.z,
          w: footprint.w,
          d: footprint.d,
          h: 8,
          angle: 0,
          kind: "legacy-camera",
        }) >= required,
    );
    view.streetLife = view.streetLife.filter(
      (person) =>
        realCorridorBuildingClearance({
          x: person.x,
          z: person.z,
          w: 0.8,
          d: 0.8,
          h: 2,
          angle: 0,
          kind: "legacy-person",
        }) >= REAL_HCM_CORRIDOR.shoulderWidth * 0.5,
    );
    view.steamVents = view.steamVents.filter(
      (vent) =>
        realCorridorBuildingClearance({
          x: vent.x,
          z: vent.z,
          w: 0.6,
          d: 0.6,
          h: 1,
          angle: 0,
          kind: "legacy-steam",
        }) >= REAL_HCM_CORRIDOR.shoulderWidth * 0.5,
    );
  };
}
