import * as THREE from "three";
import { random } from "../game/config.js";
import {
  AVENUES,
  ALLEYS,
  HIDDEN_LANES,
  segmentDistance,
} from "../world/map.js";
import { makeScooter } from "./Characters.js";
import { cityChunks } from "./batch.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const SIGNS = [
  "CÀ PHÊ MÂY NHỎ",
  "CƠM TẤM CÔ BẢY",
  "HỦ TIẾU CHÚ SÁU",
  "SỬA XE TẤN LỘC",
  "TẠP HÓA MÙA HẠ",
  "BÚN BÒ DÌ ÚT",
  "CHỢ AN HÒA",
  "HẺM 26  ↗",
  "NƯỚC MÍA GÓC PHỐ",
  "BÁNH MÌ BẾN GIÓ",
  "CHUNG CƯ NẮNG",
  "ỐC ĐÊM CÔ HẠNH",
  "XE ÔM · BẾN GIÓ",
  "CHÈ NHÀ MÍT",
  "GIẶT ỦI NẮNG MAI",
  "ĐẠI LỘ SÀI GÒN",
];
const PALETTE = [0xe7c591, 0xd89777, 0x81aea0, 0xe3d8b7, 0x8caab9, 0xc97662];

export function buildCity(view) {
  const rng = random("saigon-memory-map-1"),
    root = view.root;
  root.clear();
  const solid = new THREE.Group();
  const box = (c, x, y, z, w, h, d, g) => {
    const mesh = view.mesh(solid, c, x, y, z, w, h, d, g);
    if (h > 4 && w >= 3 && d >= 3) view.buildingFootprints.push({ x, z, w, d });
    return mesh;
  };
  const pot = (x, z, size = 1, y = 0) => {
    box(
      0xb47e60,
      x,
      y + 0.27 * size,
      z,
      0.34 * size,
      0.5 * size,
      0.34 * size,
      view.cylinder,
    );
    for (let i = 0; i < 4; i++) {
      const leaf = box(
        i % 2 ? 0x6f934f : 0x3f7b63,
        x + Math.sin(i * 2) * 0.2 * size,
        y + (0.8 + i * 0.1) * size,
        z + Math.cos(i * 2) * 0.2 * size,
        0.14 * size,
        0.7 * size,
        0.32 * size,
        view.sphere,
      );
      leaf.rotation.z = Math.sin(i * 2) * 0.5;
    }
  };
  const cable = (a, b, sag = 0.5) => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...a),
      new THREE.Vector3(
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2 - sag,
        (a[2] + b[2]) / 2,
      ),
      new THREE.Vector3(...b),
    );
    const points = curve.getPoints(8);
    for (let i = 1; i < points.length; i++) {
      const delta = points[i].clone().sub(points[i - 1]),
        mid = points[i]
          .clone()
          .add(points[i - 1])
          .multiplyScalar(0.5);
      const segment = box(
        0x354747,
        mid.x,
        mid.y,
        mid.z,
        0.035,
        delta.length(),
        0.035,
        view.cylinder,
      );
      segment.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        delta.normalize(),
      );
    }
  };
  const gallery = (x, z, length, angle = 0) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = angle;
    solid.add(group);
    const part = (c, x, y, z, w, h, d) => view.mesh(group, c, x, y, z, w, h, d);
    part(0xe2ccb0, 0, 3.65, 0, length, 0.23, 1.3);
    part(0x357b99, 0, 4.55, -0.59, length, 0.09, 0.08);
    part(0x357b99, 0, 3.9, -0.59, length, 0.07, 0.08);
    for (let xx = -length / 2 + 0.4; xx < length / 2; xx += 0.65)
      part(0x4c92b2, xx, 4.2, -0.59, 0.055, 0.68, 0.055);
    for (let xx = -length / 2 + 0.5; xx < length / 2; xx += 4) {
      part(0x3a7993, xx, 1.8, -0.45, 0.16, 3.6, 0.16);
      part(0x355d4d, xx + 1.2, 5.15, -0.06, 1.5, 1.9, 0.12);
      for (let yy = 4.35; yy < 6.1; yy += 0.23)
        part(0x6b9075, xx + 1.2, yy, -0.15, 1.42, 0.06, 0.11);
      part(0xe8d0a6, xx + 1.2, 6.2, -0.07, 1.8, 0.2, 0.24);
      part(0x2e5050, xx + 1.2, 1.45, -0.07, 1.7, 2.8, 0.12);
      part(0xc9c2a0, xx + 1.2, 2.91, -0.15, 1.9, 0.15, 0.14);
      for (let bar = xx + 0.5; bar < xx + 1.95; bar += 0.26)
        part(0x829693, bar, 1.45, -0.16, 0.04, 2.75, 0.06);
    }
    part(0x648983, 0, 6.65, 0.16, length + 0.3, 0.12, 1.9);
  };
  box(0x9fa897, 0, -0.7, 0, 225, 1, 225);
  for (const v of AVENUES) {
    box(0x60666a, v, -0.03, 0, 14, 0.15, 178);
    box(0x60666a, 0, -0.02, v, 178, 0.15, 14);
  }
  for (const v of ALLEYS) {
    box(0x7b8071, v, -0.02, 0, 5, 0.14, 144);
    box(0x7b8071, 0, -0.01, v, 144, 0.14, 5);
  }
  for (const lane of HIDDEN_LANES)
    for (let i = 1; i < lane.points.length; i++) {
      const a = lane.points[i - 1],
        b = lane.points[i];
      box(
        0xaa9e86,
        (a.x + b.x) / 2,
        0.08,
        (a.z + b.z) / 2,
        Math.abs(a.x - b.x) + lane.width,
        0.15,
        Math.abs(a.z - b.z) + lane.width,
      );
    }
  // Asphalt edge and curb widths stay outside the actual driveable corridors.
  for (const v of AVENUES)
    for (const side of [-1, 1]) {
      box(0xc9c5a9, v + side * 7.3, 0.12, 0, 0.6, 0.26, 178);
      box(0xc9c5a9, 0, 0.12, v + side * 7.3, 178, 0.26, 0.6);
    }
  for (const v of AVENUES)
    for (let t = -82; t < 89; t += 9) {
      if (AVENUES.some((a) => Math.abs(t - a) < 10)) continue;
      box(0xe6d3a1, v, 0.07, t, 0.16, 0.03, 3);
      box(0xe6d3a1, t, 0.08, v, 3, 0.03, 0.16);
    }
  for (const x of AVENUES)
    for (const z of AVENUES)
      for (let j = -4; j <= 4; j += 2) {
        box(0xc5c2a8, x + j, 0.09, z - 6, 1, 0.025, 2.2);
        box(0xc5c2a8, x - 6, 0.1, z + j, 2.2, 0.025, 1);
      }
  const atlas = document.createElement("canvas");
  atlas.width = 1024;
  atlas.height = 512;
  const ctx = /** @type {CanvasRenderingContext2D} */ (atlas.getContext("2d"));
  const backs = ["#e8d7af", "#b44731", "#d9bd77", "#264a59"];
  const sublines = [
    "CÀ PHÊ SỮA ĐÁ · TRÀ ĐÁ",
    "SƯỜN · BÌ · CHẢ",
    "HỦ TIẾU · MÌ · NUI",
    "VÁ VỎ · THAY NHỚT",
    "GẠO · ĐƯỜNG · SỮA",
    "BÚN BÒ · GIÒ HEO",
    "HÀNG KHÔ · RAU CỦ",
    "ĐƯỜNG NÀY THÔNG",
    "MÍA TẮC · MÁT LẠNH",
    "BÁNH MÌ NÓNG MỖI SÁNG",
    "LỐI VÀO KHU NHÀ",
    "ỐC HƯƠNG · NGHÊU HẤP",
    "ĐI ĐÂU? LÊN XE!",
    "CHÈ ĐẬU · SƯƠNG SÁO",
    "NHẬN GIẶT · ỦI ĐỒ",
    "ĐI CHẬM QUA NGÃ TƯ",
  ];
  for (let i = 0; i < SIGNS.length; i++) {
    const x = (i % 4) * 256,
      y = Math.floor(i / 4) * 128;
    ctx.fillStyle = backs[i % 4];
    ctx.fillRect(x, y, 256, 128);
    ctx.strokeStyle = "#ecd6aa";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 7, y + 7, 242, 114);
    ctx.textAlign = "center";
    ctx.fillStyle =
      i % 4 === 0 ? "#a54130" : i % 4 === 2 ? "#25403e" : "#fff1d2";
    ctx.font = "900 28px Arial";
    ctx.fillText(SIGNS[i], x + 128, y + 67, 230);
    ctx.font = "10px Arial";
    ctx.fillText(sublines[i], x + 128, y + 94);
  }
  const texture = new THREE.CanvasTexture(atlas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(
    4,
    view.renderer.capabilities.getMaxAnisotropy(),
  );
  const signMat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });
  const signGeometries = [];
  function sign(index, x, y, z, width = 6, height = 2.1, angle = 0) {
    const geo = new THREE.PlaneGeometry(width, height);
    const uv = geo.attributes.uv;
    const col = index % 4,
      row = Math.floor(index / 4);
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (col + uv.getX(i)) / 4, 1 - (row + 1 - uv.getY(i)) / 4);
    geo.rotateY(angle);
    geo.translate(x, y, z);
    signGeometries.push(geo);
  }
  const starts = [-65, -33, 7, 39];
  for (let ix = 0; ix < starts.length; ix++)
    for (let iz = 0; iz < starts.length; iz++) {
      const x0 = starts[ix],
        z0 = starts[iz],
        market = ix < 2 && iz > 1;
      // This lot is authored below around the collision-backed dogleg courtyard.
      if (x0 === 7 && z0 === -33) continue;
      box(0xbabda2, x0 + 13, 0.12, z0 + 13, 26, 0.3, 26);
      for (let n = 0; n < 3; n++) {
        const x =
            x0 +
            4.5 +
            n * 8.4 +
            (n === 0 && ix % 2 === 0 ? 1 : n === 2 && ix % 2 === 1 ? -1 : 0),
          w =
            n === 0 && ix % 2 === 0
              ? 5.4
              : n === 2 && ix % 2 === 1
                ? 5.1
                : [7.4, 8.1, 7.1][n],
          h = 6 + rng() * 8;
        const colour = market
          ? 0xd0b58c
          : PALETTE[Math.floor(rng() * PALETTE.length)];
        box(colour, x, h / 2, z0 + 7, w, h, 8.8);
        box(0x7f8780, x, h + 0.15, z0 + 7, w + 0.35, 0.4, 9.1);
        box(
          market ? 0x934c3d : 0xe5dcc0,
          x,
          h - 0.4,
          z0 + 2.4,
          w + 0.2,
          0.5,
          0.5,
        );
        box(0x324d4c, x, 1.6, z0 + 2.49, w - 1.2, 2.7, 0.1);
        const signIndex = (ix * 4 + iz * 3 + n) % SIGNS.length;
        sign(signIndex, x, 3.5, z0 + 2.35, w - 0.4, 1.45, Math.PI);
        const awning = box(
          n % 2 === 0 ? 0xbd6549 : 0x65978b,
          x,
          2.75,
          z0 + 1.8,
          w,
          0.15,
          2,
        );
        awning.rotation.x = 0.1;
        for (let stripe = 0; stripe < 6; stripe++)
          box(
            0xe4d4ae,
            x - w / 2 + 0.65 + stripe * 1.25,
            2.77,
            z0 + 1.8,
            0.45,
            0.035,
            1.9,
          );
        for (let level = 5; level < h - 1; level += 3.1)
          for (const dx of [-2.1, 1.9]) {
            box(0x426567, x + dx, level, z0 + 2.48, 1.45, 1.6, 0.12);
            box(0xe4d5ad, x + dx, level + 0.02, z0 + 2.35, 0.12, 1.6, 0.12);
            box(0xdbcfad, x + dx, level - 1, z0 + 2, 2.3, 0.15, 1.1);
            box(0x607979, x + dx, level - 0.65, z0 + 1.44, 2.3, 0.62, 0.09);
            for (let slat = level - 0.6; slat < level + 0.7; slat += 0.28)
              box(0x8ba294, x + dx, slat, z0 + 2.35, 1.35, 0.07, 0.08);
          }
        // Separate storefront details interrupt identical block silhouettes.
        if (n === 0) {
          box(0xddccb0, x - 1.2, 4.7, z0 + 2.23, 1.4, 0.75, 0.5);
          box(0x7b8c84, x - 1.2, 4.7, z0 + 1.96, 1, 0.42, 0.07);
          pot(x + 2.7, z0 + 1, 0.7, h + 0.35);
        }
        if (n === 2) {
          for (let ledge = 0; ledge < 6; ledge++)
            box(
              0xae9e82,
              x - w / 2 + 0.18,
              0.5 + ledge * 0.45,
              z0 + 2 + ledge * 0.5,
              0.85,
              0.4,
              0.5,
            );
          box(0x91a69b, x + w / 2 - 0.25, h / 2, z0 + 2.25, 0.07, h, 0.08);
        }
        if (n === 1) {
          box(
            0x71949a,
            x + 1.4,
            h + 0.9,
            z0 + 6,
            1.05,
            1.6,
            1.05,
            view.cylinder,
          );
          box(
            0xd5dfcf,
            x + 1.4,
            h + 1.75,
            z0 + 6,
            1.1,
            0.1,
            1.1,
            view.cylinder,
          );
        }
        // Back-facing row makes alleys inhabited on both sides.
        const backH = 5 + rng() * 5;
        box(
          PALETTE[(ix + iz + n + 2) % PALETTE.length],
          x,
          backH / 2,
          z0 + 19,
          w,
          backH,
          8.5,
        );
        box(0x687f75, x, backH + 0.2, z0 + 19, w + 0.4, 0.4, 9);
        box(0x335b58, x, 1.6, z0 + 23.3, 4, 2.9, 0.1);
        sign((signIndex + 5) % 16, x, 3.9, z0 + 23.4, 6, 1.5);
        for (const dx of [-2, 2])
          box(0x5b7f7b, x + dx, backH - 1.5, z0 + 23.35, 1.6, 1.8, 0.13);
        if (n === 0) {
          box(0xc7c6a5, x + 1, 4.5, z0 + 23.9, 3, 0.12, 0.7);
          for (let shirt = 0; shirt < 3; shirt++)
            box(
              [0xe5ab7e, 0xbacccc, 0xdfd2a7][shirt],
              x + 0.1 + shirt * 0.8,
              4,
              z0 + 23.9,
              0.6,
              0.65,
              0.05,
            );
        }
      }
      // Shop ends facing cross streets: visible shutters and paired windows.
      for (const side of [
        ix % 2 === 0 ? 2.79 : 0.79,
        ix % 2 === 1 ? 22.86 : 24.86,
      ])
        for (const depth of [6, 20]) {
          box(0x4d7771, x0 + side, 2, z0 + depth, 0.1, 2.8, 3);
          box(0xcebe99, x0 + side, 3.7, z0 + depth, 0.25, 0.4, 3.4);
        }
      if (ix % 2 === 0) {
        gallery(x0 + 2.6, z0 + 13, 22, Math.PI / 2);
        sign((ix + iz * 3) % 16, x0 + 2.74, 3.03, z0 + 9, 7, 1.1, -Math.PI / 2);
      }
    }
  // Hẻm 26: three unequal homes, continuous blue galleries and a high crossing.
  for (const [x, z, w, d, h, c] of [
    [11.2, -30, 3.6, 6, 7.2, 0xe0c295],
    [26.5, -25, 13, 16, 8.1, 0xdac59a],
    [11.2, -13.5, 3.6, 13, 7.5, 0x9bb9a8],
  ]) {
    box(c, x, h / 2, z, w, h, d);
    box(0x748a82, x, h + 0.1, z, w + 0.35, 0.24, d + 0.35);
    box(0x7eacaa, x + 1, h + 0.9, z, 0.85, 1.5, 0.85, view.cylinder);
  }
  gallery(13, -13.5, 12, -Math.PI / 2);
  gallery(20, -25, 15, Math.PI / 2);
  box(0xdac4a0, 16.5, 4.05, -27.6, 7, 0.3, 1.3);
  box(0x4d92ad, 16.5, 4.85, -28.2, 7, 0.1, 0.08);
  for (let x = 13.2; x < 20; x += 0.6)
    box(0x4d92ad, x, 4.5, -28.2, 0.06, 0.65, 0.06);
  for (const [x, z] of [
    [13.7, -19],
    [13.7, -8],
    [19.4, -19],
    [19.4, -30],
    [30, -16.4],
    [8, -27],
  ])
    pot(x, z, 0.9);
  for (const y of [5.3, 5.55, 5.7])
    cable([12.8, y, -19], [20, y + 0.2, -21], 0.55);
  for (let i = 0; i < 4; i++) {
    box(
      [0xd98863, 0xc3d6bd, 0x789eae, 0xe4c073][i],
      14 + i * 1.2,
      5.05,
      -20,
      0.7,
      0.95,
      0.05,
    );
  }
  // Mount the alley sign on its wall, outside the turning/camera corridor.
  sign(7, 9.35, 5.2, -29.2, 3.2, 1.1, -Math.PI / 2);
  sign(0, 9.35, 3.1, -30, 4.5, 1.35, -Math.PI / 2);
  sign(10, 20, 6.6, -23, 8, 1.1, -Math.PI / 2);
  view.streetLife.push(
    { x: 13.7, z: -9.4, seated: true, angle: Math.PI / 2 },
    { x: 19.6, z: -18, seated: false, angle: -Math.PI / 2 },
  );
  // Outer shopfront ribbons keep the district feeling larger than its road graph.
  for (let i = 0; i < 18; i++) {
    const v = -86 + i * 10,
      h = 7 + rng() * 13;
    box(PALETTE[i % 6], v, h / 2, -96, 9.7, h, 13);
    box(0x597578, v, h + 0.2, -96, 10, 0.5, 13.5);
    sign(i % 16, v, 3.8, -89.3, 8, 2.2);
    box(0x31565a, v, 1.5, -89.4, 7.3, 2.8, 0.2);
    for (let floor = 6; floor < h - 1; floor += 3)
      for (const dx of [-2.5, 0, 2.5])
        box(0x507f83, v + dx, floor, -89.35, 1.6, 1.8, 0.13);
    box(PALETTE[(i + 3) % 6], -96, h / 2, v, 13, h, 9.7);
    sign((i + 3) % 16, -89.3, 3.6, v, 7.5, 2.1, Math.PI / 2);
  }
  // Chợ Lớn-inspired market roof, a local visual anchor, not a copied monument.
  box(0xcbb78d, -53, 4.1, 52, 22, 8.2, 20);
  const roof = box(0xa9503c, -53, 8.7, 52, 24, 1.6, 22);
  roof.rotation.z = 0.04;
  box(0xd9bc72, -53, 10, 52, 25, 0.3, 2);
  sign(6, -53, 5.2, 40.9, 14, 3, Math.PI);
  for (let col = -62; col <= -44; col += 6)
    box(0x934936, col, 2.7, 41.4, 0.5, 5.4, 0.5);
  // Canal is outside the riding boundary; the riverside boulevard is the fast scenic choice.
  box(0x4f9597, 104, -0.25, 0, 24, 0.12, 225);
  box(0xc7c0a1, 89.8, 0.4, 0, 1, 1, 185);
  for (let z = -88; z < 92; z += 5) {
    box(0x768e82, 90.2, 1.2, z, 0.2, 1.5, 0.2);
  }
  box(0x859e8f, 90.2, 1.8, 0, 0.16, 0.15, 185);
  for (const z of [-72, 72]) {
    box(0xb6b39b, 107, 0.65, z, 34, 1.4, 12);
    box(0x7e9690, 107, 2, z - 5.5, 34, 0.6, 0.35);
    box(0x7e9690, 107, 2, z + 5.5, 34, 0.6, 0.35);
  }
  for (let i = 0; i < 20; i++) {
    const x = 100 + (i % 3) * 5,
      z = -90 + i * 9;
    box(0x8dc1b7, x, -0.12, z, 4, 0.025, 0.15);
  }
  box(0x355b53, 107, 0.2, -22, 3, 0.8, 11);
  box(0xcea875, 107, 1, -22, 2.7, 0.6, 5);
  // Street furniture stays on the curb, so decoration never creates invisible collisions.
  for (let i = 0; i < 28; i++) {
    const z = -82 + i * 6,
      x = i % 2 ? 8.4 : -8.4;
    if (
      AVENUES.some((a) => Math.abs(z - a) < 10) ||
      ALLEYS.some((a) => Math.abs(z - a) < 5) ||
      // Reserve 5m around the dogleg for canopy and chase-camera sightlines.
      HIDDEN_LANES.some((lane) =>
        lane.points
          .slice(1)
          .some((b, i) => segmentDistance(x, z, lane.points[i], b) < 5),
      )
    )
      continue;
    box(0x486b5c, x, 1.9, z, 0.35, 3.8, 0.35);
    box(0x749c71, x, 5, z, 2.4, 2.6, 2.4, view.sphere);
    box(0x90aa79, x + 0.8, 4.5, z + 0.4, 1.7, 1.8, 1.7, view.sphere);
  }
  for (const z of [-58, -21, 18, 55]) {
    box(0x536e66, -7.6, 6, z, 0.17, 12, 0.17);
    box(0x536e66, 7.6, 6, z, 0.17, 12, 0.17);
    for (const dz of [0, 0.22, 0.44]) {
      cable([-7.6, 8.7, z + dz], [7.6, 9.4, z + dz], 1.1);
    }
  }
  for (let i = 0; i < 24; i++) {
    const x = -62 + (i % 6) * 8.5,
      z = i < 12 ? -8.5 : 8.5;
    box(i % 2 ? 0xc96142 : 0x629b87, x, 0.55, z, 0.9, 0.16, 0.9);
    for (const dx of [-0.33, 0.33])
      box(0x9c563c, x + dx, 0.25, z, 0.12, 0.5, 0.65);
    if (i % 4 === 0) {
      box(0xb7bca9, x + 1.6, 0.7, z, 1.3, 0.1, 1.3);
      box(0x6d8075, x + 1.6, 0.33, z, 0.12, 0.65, 0.12);
    }
  }
  // Food cart: grill, wheels and canopy, enough shape to read without imported models.
  for (const x of [-61, -48, -19, 19]) {
    box(0x9da496, x, 1.1, -8.8, 2.1, 1.4, 1.3);
    box(0x4a5c55, x, 1.9, -8.8, 1.8, 0.2, 1);
    box(0xe6aa56, x, 3, -8.8, 3, 0.2, 2);
    for (const side of [-1, 1])
      box(0x577268, x + side, 2.2, -8.8, 0.09, 1.4, 0.09);
    view.steamVents.push({ x, z: -8.8, y: 2 });
    view.streetLife.push({ x: x + 1.65, z: -8.8, seated: false, angle: 0 });
  }
  // The opening café has things to do and people to meet at rider-eye height.
  for (const [x, z, angle] of [
    [8.1, -30, -Math.PI / 2],
    [-8.4, -27, Math.PI / 2],
  ]) {
    box(0xb9c5bd, x, 1.0, z, 1.35, 1.4, 2.2);
    box(0x456b73, x, 2, z, 1.4, 0.12, 2.3);
    box(0xe1c899, x, 3, z, 2.3, 0.18, 3.3);
    for (const offset of [-1, 1])
      box(0x5c7577, x, 2.5, z + offset, 0.05, 1.1, 0.05);
    box(0xd8d9bd, x, 1.88, z + 0.35, 0.35, 0.42, 0.35, view.cylinder);
    box(0x657573, x, 2.1, z + 0.35, 0.4, 0.08, 0.4, view.cylinder);
    view.steamVents.push({ x, z: z + 0.35, y: 2.1 });
    view.streetLife.push({ x: x + (x > 0 ? 1 : -1), z, seated: false, angle });
    for (const offset of [-2, 2]) {
      const sz = z + offset;
      box(offset < 0 ? 0xc75f48 : 0x3c819c, x, 0.43, sz, 0.67, 0.16, 0.67);
      for (const side of [-1, 1])
        box(0x3f7190, x + side * 0.25, 0.2, sz, 0.08, 0.4, 0.55);
      view.streetLife.push({
        x,
        z: sz,
        seated: true,
        angle: offset < 0 ? 0 : Math.PI,
      });
      box(0xd9baa1, x, 0.75, sz + Math.sign(-offset) * 0.65, 0.75, 0.08, 0.75);
      box(
        0xe9e3c7,
        x,
        0.84,
        sz + Math.sign(-offset) * 0.65,
        0.19,
        0.1,
        0.19,
        view.cylinder,
      );
    }
  }
  for (const [x, z, angle] of [
    [-8, -32, -0.5],
    [-8, -49, 0.4],
    [8, -14, -0.4],
    [21, -18, -0.8],
    [-9, -17, 0.5],
    [-26, 8, 0.8],
    [-53, 8, -0.7],
    [68, 42, 1.1],
  ]) {
    const bike = makeScooter(
      view,
      [0x7c9f9c, 0xb96c55, 0xd6d0b7][Math.floor(rng() * 3)],
      false,
      true,
    );
    bike.position.set(x, 0, z);
    bike.rotation.y = angle;
    solid.add(bike);
  }
  // Simple skyline silhouettes frame low-rise streets.
  for (let i = 0; i < 16; i++) {
    const x = -120 + i * 17,
      h = 25 + rng() * 38,
      z = 115 + rng() * 18;
    box(0x799b97, x, h / 2, z, 10 + rng() * 8, h, 12);
    for (let y = 5; y < h; y += 4) box(0xa4bab0, x, y, z - 6.05, 9, 0.6, 0.1);
  }
  root.add(cityChunks(solid));
  // The atlas needs its own material; merge all sign planes into one draw call.
  const merged = mergeGeometries(signGeometries, false);
  if (!merged) throw new Error("Sign atlas batch failed");
  root.add(new THREE.Mesh(merged, signMat));
  for (const geo of signGeometries) geo.dispose();
}
