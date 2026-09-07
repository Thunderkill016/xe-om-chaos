import { readFile, writeFile } from "node:fs/promises";

async function edit(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) return false;
  await writeFile(path, after);
  return true;
}
function replaceRequired(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) throw new Error(`Missing ${label}: ${from}`);
  return text.replace(from, to);
}

await edit("src/main.js", (input) => {
  let text = input;
  text = replaceRequired(
    text,
    'import { addDowntownCinematic } from "./view/Downtown.js";',
    'import { addDowntownCinematic } from "./view/Downtown.js";\nimport { addRealHcmContext } from "./view/OsmContext.js";',
    "OSM context import",
  );
  text = replaceRequired(
    text,
    "  addDowntownCinematic(view);",
    "  addDowntownCinematic(view);\n  addRealHcmContext(view);",
    "OSM context mount",
  );
  return text;
});

await edit("src/view/Scene.js", (input) => {
  let text = input;
  text = replaceRequired(
    text,
    "    this.renderer.toneMappingExposure = 1.15;",
    "    this.renderer.toneMappingExposure = 1.08;",
    "cinematic exposure",
  );
  text = replaceRequired(
    text,
    "    this.scene.background = new THREE.Color(0xb2cfca);\n    this.scene.fog = new THREE.Fog(0xb2cfca, 110, 290);",
    "    this.scene.background = new THREE.Color(0xc8d1d0);\n    this.scene.fog = new THREE.FogExp2(0xbfc9c5, 0.0046);",
    "humid HCMC atmosphere",
  );
  text = replaceRequired(
    text,
    "    this.scene.add(new THREE.HemisphereLight(0xc9e3f1, 0x68717c, 1.5));\n    this.sun = new THREE.DirectionalLight(0xffdab0, 3);\n    this.sun.position.set(-50, 90, -30);",
    "    this.scene.add(new THREE.HemisphereLight(0xdde7ff, 0x665244, 1.55));\n    this.scene.add(new THREE.AmbientLight(0xffe8d2, 0.2));\n    this.sun = new THREE.DirectionalLight(0xffbd78, 4.1);\n    this.sun.position.set(-58, 72, -34);",
    "golden hour lighting",
  );
  text = replaceRequired(
    text,
    "        new THREE.MeshLambertMaterial({ color: colour, flatShading: true }),",
    "        new THREE.MeshStandardMaterial({\n          color: colour,\n          roughness: 0.72,\n          metalness: 0.025,\n          flatShading: false,\n        }),",
    "PBR primitive material",
  );
  text = replaceRequired(
    text,
    "    this.camera.position.set(-115, 92, -118);\n    this.camera.lookAt(0, 0, 5);",
    "    this.camera.position.set(-14, 7.4, -25);\n    this.camera.lookAt(0, 1.8, 8);",
    "street-level opening camera",
  );
  text = replaceRequired(
    text,
    "      const followDistance = 10.8 + speedRatio * 2.2;\n      const cameraHeight = 6.8 + speedRatio * 1.1;",
    "      const followDistance = 8.9 + speedRatio * 1.9;\n      const cameraHeight = 4.9 + speedRatio * 0.8;",
    "closer chase camera",
  );
  text = replaceRequired(
    text,
    "      const lookAhead = 9.5 + speedRatio * 7;",
    "      const lookAhead = 12.5 + speedRatio * 8.5;",
    "traffic look-ahead",
  );
  text = replaceRequired(
    text,
    "        : 50 + speedRatio * 10 + (p.boosting ? 2 : 0);",
    "        : 54 + speedRatio * 8 + (p.boosting ? 2 : 0);",
    "cinematic chase FOV",
  );
  text = replaceRequired(
    text,
    "      this.camera.position.set(-105, 87, -115);\n      this.camera.lookAt(8, 0, 8);",
    "      this.camera.position.set(-14, 7.4, -25);\n      this.camera.lookAt(0, 1.8, 8);",
    "menu street camera",
  );
  return text;
});

await edit("src/view/batch.js", (input) => {
  let text = input;
  text = replaceRequired(
    text,
    "export const vertexMaterial = () =>\n  new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });",
    "export const vertexMaterial = () =>\n  new THREE.MeshStandardMaterial({\n    vertexColors: true,\n    roughness: 0.76,\n    metalness: 0.02,\n    flatShading: false,\n  });",
    "PBR batched city material",
  );
  return text;
});

for (const [path, href] of [
  ["index.html", "./premium.css"],
  ["en/index.html", "../premium.css"],
]) {
  await edit(path, (input) => {
    if (input.includes(`href=\"${href}\"`)) return input;
    const marker = '<link rel="stylesheet" href="./style.css" />';
    const enMarker = '<link rel="stylesheet" href="../style.css" />';
    if (input.includes(marker))
      return input.replace(marker, `${marker}\n    <link rel="stylesheet" href="${href}" />`);
    if (input.includes(enMarker))
      return input.replace(enMarker, `${enMarker}\n    <link rel="stylesheet" href="${href}" />`);
    throw new Error(`Stylesheet marker missing in ${path}`);
  });
}

console.log("Cinematic visual pass applied.");
