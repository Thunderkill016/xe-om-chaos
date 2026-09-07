import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
import path from "node:path";

const target = path.resolve("dist");
await mkdir(path.join(target, "vendor"), { recursive: true });

async function packageHtml(source, destination, prefix) {
  let html = await readFile(source, "utf8");
  html = html
    .replace(
      `${prefix}node_modules/three/build/three.module.js`,
      `${prefix}vendor/three.module.js`,
    )
    .replace(
      `${prefix}node_modules/three/examples/jsm/`,
      `${prefix}vendor/addons/`,
    )
    .replace(
      `${prefix}node_modules/playcanvas/build/playcanvas.mjs`,
      `${prefix}vendor/playcanvas.mjs`,
    );
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, html);
}

await packageHtml("index.html", path.join(target, "index.html"), "./");
await packageHtml("en/index.html", path.join(target, "en/index.html"), "../");
await cp("style.css", path.join(target, "style.css"));
await cp("premium.css", path.join(target, "premium.css"));
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
await cp(
  "node_modules/playcanvas/build/playcanvas.mjs",
  path.join(target, "vendor/playcanvas.mjs"),
);
await cp(
  "node_modules/playcanvas/build/playcanvas",
  path.join(target, "vendor/playcanvas"),
  { recursive: true },
);
await cp(
  "node_modules/playcanvas/LICENSE",
  path.join(target, "vendor/PLAYCANVAS-LICENSE.txt"),
);
console.log(
  "Static site ready in dist/ with Vietnamese and international editions plus vendored Three.js and PlayCanvas; no runtime CDN or Node dependency.",
);
