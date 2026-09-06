import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
import path from "node:path";

const target = path.resolve("dist");
await mkdir(path.join(target, "vendor"), { recursive: true });
let html = await readFile("index.html", "utf8");
html = html
  .replace(
    "./node_modules/three/build/three.module.js",
    "./vendor/three.module.js",
  )
  .replace("./node_modules/three/examples/jsm/", "./vendor/addons/");
await writeFile(path.join(target, "index.html"), html);
await cp("style.css", path.join(target, "style.css"));
await cp("src", path.join(target, "src"), { recursive: true });
for (const file of ["three.module.js", "three.core.js"])
  await cp(
    "node_modules/three/build/" + file,
    path.join(target, "vendor", file),
  );
await mkdir(path.join(target, "vendor/addons/utils"), { recursive: true });
await cp(
  "node_modules/three/examples/jsm/utils/BufferGeometryUtils.js",
  path.join(target, "vendor/addons/utils/BufferGeometryUtils.js"),
);
await cp(
  "node_modules/three/LICENSE",
  path.join(target, "vendor/THREE-LICENSE.txt"),
);
console.log(
  "Static site ready in dist/. Serve over HTTP; no runtime CDN or Node dependency.",
);
