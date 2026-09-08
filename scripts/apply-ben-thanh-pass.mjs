import { readFile, writeFile } from "node:fs/promises";

const path = "src/view/PlayCanvasScene.js";
let source = await readFile(path, "utf8");

if (!source.includes('from "./BenThanhLandmark.js"')) {
  source = source.replace(
    'import { CONFIG } from "../game/config.js";\n',
    'import { CONFIG } from "../game/config.js";\nimport { buildBenThanhLandmark } from "./BenThanhLandmark.js";\n',
  );
}

const methodStart = source.indexOf("  buildBenThanhLandmark() {");
const nextMethod = source.indexOf("\n  buildNguyenHueEnd() {", methodStart);
if (methodStart < 0 || nextMethod < 0) {
  throw new Error("Could not locate buildBenThanhLandmark block");
}
source =
  source.slice(0, methodStart) +
  '  buildBenThanhLandmark() {\n    return buildBenThanhLandmark(this);\n  }\n' +
  source.slice(nextMethod);

const oldCamera = `    const menuStart = REAL_HCM_CORRIDOR.points[0];
    const menuNext = REAL_HCM_CORRIDOR.points[1];
    const menuFrame = segmentFrame(menuStart, menuNext);
    this.menuCamera = {
      x: menuStart.x - (menuFrame.dx / menuFrame.length) * 13,
      y: 6.2,
      z: menuStart.z - (menuFrame.dz / menuFrame.length) * 13,
      tx: menuStart.x + (menuFrame.dx / menuFrame.length) * 22,
      ty: 1.7,
      tz: menuStart.z + (menuFrame.dz / menuFrame.length) * 22,
    };
`;
const newCamera = `    const menuStart = REAL_HCM_CORRIDOR.points[0];
    const menuNext = REAL_HCM_CORRIDOR.points[1];
    const menuFrame = segmentFrame(menuStart, menuNext);
    const landmark = this.benThanhAnchor;
    const aheadX = menuStart.x + (menuFrame.dx / menuFrame.length) * 16;
    const aheadZ = menuStart.z + (menuFrame.dz / menuFrame.length) * 16;
    this.menuCamera = {
      x:
        menuStart.x +
        menuFrame.nx * 9 -
        (menuFrame.dx / menuFrame.length) * 10,
      y: 7.1,
      z:
        menuStart.z +
        menuFrame.nz * 9 -
        (menuFrame.dz / menuFrame.length) * 10,
      tx: landmark ? landmark.x * 0.58 + aheadX * 0.42 : aheadX,
      ty: 4.1,
      tz: landmark ? landmark.z * 0.58 + aheadZ * 0.42 : aheadZ,
    };
`;
if (source.includes(oldCamera)) source = source.replace(oldCamera, newCamera);
else if (!source.includes("const landmark = this.benThanhAnchor;"))
  throw new Error("Could not locate menu camera block");

await writeFile(path, source);
