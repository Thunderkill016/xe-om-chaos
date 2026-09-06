import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { chromium, firefox, webkit, devices } from "playwright";
import { Run } from "../src/game/Run.js";
import { openingRoutes } from "./evaluate-routes.mjs";

const engine = process.env.XEOM_BROWSER || "chromium";
const browserType = { chromium, firefox, webkit }[engine];
if (!browserType) throw new Error("Unknown XEOM_BROWSER");
// On this Linux host, headless Chrome falls back to CPU SwiftShader. This opt-in
// uses the desktop GL context for a separate hardware-backed acceptance run.
const headed = engine === "chromium" && process.env.XEOM_HEADED === "1";
// VS Code Snap's GIO plugins load core20 libpthread into system WebKit, breaking
// even a plain CSS request. Use system plugin discovery only in this child process.
const browserEnv = { ...process.env };
for (const key of ["GIO_MODULE_DIR", "GTK_PATH"])
  if (browserEnv[key]?.includes("/snap/")) delete browserEnv[key];
const browser = await browserType.launch(
  engine === "chromium"
    ? {
        executablePath:
          process.env.XEOM_CHROME_PATH ||
          (existsSync("/opt/google/chrome/chrome")
            ? "/opt/google/chrome/chrome"
            : undefined),
        headless: !headed,
        env: browserEnv,
        args: headed
          ? [
              "--no-sandbox",
              "--use-angle=gl",
              "--ignore-gpu-blocklist",
              "--ozone-platform=x11",
              "--window-position=-2000,-2000",
            ]
          : ["--no-sandbox", "--enable-unsafe-swiftshader"],
      }
    : { headless: true, env: browserEnv },
);
const output = process.env.XEOM_OUTPUT || "output/playwright";
await mkdir(output, { recursive: true });
const report = {
  engine,
  launchMode: headed ? "headed-x11-gl" : "headless",
  started: new Date().toISOString(),
  checks: [],
  errors: [],
  warnings: [],
};
const base = (process.env.XEOM_URL || "http://localhost:4173").replace(
  /\/$/,
  "",
);
report.base = base;
report.browserVersion = browser.version();
const soak = process.env.XEOM_SOAK === "1";
function check(name, value) {
  assert.ok(value, name);
  report.checks.push(name);
  console.log("PASS", name);
}
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const requests = new Set();
  page.on("request", (request) => requests.add(request.url()));
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "warning") report.warnings.push(message.text());
    if (message.type() === "error") report.errors.push(message.text());
  });
  await page.goto(base + "/?debug=1&seed=2026-09-06");
  await page.waitForFunction(() => Boolean(window.xeom?.view));
  report.simulationVersion = await page.evaluate(
    () => window.xeom.run.record.version,
  );
  await page.evaluate(() => {
    document.getElementById("debug").hidden = true;
  });
  await page.screenshot({ path: `${output}/${engine}-desktop-menu.png` });
  await page.getByRole("button", { name: "LÊN XE THÔI ↗" }).click();
  check(
    "start without account",
    (await page.locator("#timer").isVisible()) &&
      (await page.evaluate(() => window.xeom.state.playing)),
  );
  check(
    "street-life characters occupy the sidewalk rather than solid buildings",
    await page.evaluate(() =>
      window.xeom.view.streetLife.every(
        (p) =>
          !window.xeom.view.buildingFootprints.some(
            (b) =>
              Math.abs(p.x - b.x) < b.w / 2 + 0.25 &&
              Math.abs(p.z - b.z) < b.d / 2 + 0.25,
          ),
      ),
    ),
  );
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.xeom.run.player.speed > 5);
  await page.keyboard.down("a");
  await page.waitForFunction(
    () => Math.abs(window.xeom.run.player.lean) > 0.03,
  );
  check("keyboard acceleration and visible bike lean", true);
  await page.keyboard.up("a");
  await page.keyboard.up("w");
  await page.keyboard.down("s");
  await page.waitForFunction(() => window.xeom.run.player.speed === 0);
  await page.keyboard.up("s");
  check("keyboard braking stops motorcycle", true);
  await page.keyboard.press("Space");
  await page.waitForFunction(() => window.xeom.run.stats.horns > 0);
  check("horn input reaches simulation", true);
  await page.locator("#pause").click();
  const pausedTick = await page.evaluate(() => window.xeom.run.tick);
  await page.waitForTimeout(350);
  check(
    "pause freezes simulation",
    pausedTick === (await page.evaluate(() => window.xeom.run.tick)),
  );
  await page.locator("#restart-pause").click();
  check(
    "restart resets score and crash state",
    await page.evaluate(
      () =>
        window.xeom.run.stats.score === 0 &&
        window.xeom.run.stats.crashes === 0,
    ),
  );

  // Real browser keys, closed-loop steering, no position changes or simulation-clock injection.
  const hiddenRoute = process.env.XEOM_ROUTE === "hem26";
  const routes = openingRoutes(new Run("2026-09-06"));
  const route = hiddenRoute ? routes.hem26 : routes.avenue;
  let waypoint = 0;
  const held = new Set(),
    routeStart = Date.now();
  while (Date.now() - routeStart < (hiddenRoute ? 80000 : 55000)) {
    const state = await page.evaluate(() => ({
      p: window.xeom.run.player,
      phase: window.xeom.run.missions.phase,
      deliveries: window.xeom.run.stats.deliveries,
    }));
    if (state.deliveries > 0) break;
    const target = route[waypoint],
      p = state.p,
      d = Math.hypot(target.x - p.x, target.z - p.z),
      a = Math.atan2(target.x - p.x, target.z - p.z) - p.angle,
      delta = Math.atan2(Math.sin(a), Math.cos(a));
    if (
      (!target.stop && d < 3) ||
      (waypoint === 0 && state.phase === "dropoff")
    ) {
      waypoint++;
      continue;
    }
    const wanted =
      target.stop && d < 4 ? 0 : Math.abs(delta) > 0.5 ? 0 : d < 8 ? 4 : 8;
    const desired = new Set([
      ...(p.speed < wanted ? ["w"] : []),
      ...(p.speed > wanted ? ["s"] : []),
      ...(delta > 0.1 ? ["a"] : []),
      ...(delta < -0.1 ? ["d"] : []),
    ]);
    for (const key of held)
      if (!desired.has(key)) {
        await page.keyboard.up(key);
        held.delete(key);
      }
    for (const key of desired)
      if (!held.has(key)) {
        await page.keyboard.down(key);
        held.add(key);
      }
    await page.waitForTimeout(80);
  }
  for (const key of held) await page.keyboard.up(key);
  const routeState = await page.evaluate(() => ({
    stats: window.xeom.run.stats,
    time: window.xeom.run.time,
    phase: window.xeom.run.missions.phase,
    p: window.xeom.run.player,
  }));
  report.route = routeState;
  if (hiddenRoute)
    check(
      "authored hẻm completed through real browser steering",
      await page.evaluate(
        () =>
          window.xeom.run.discoveredLanes.has("hem26") &&
          window.xeom.run.stats.deliveries > 0,
      ),
    );
  check(
    "complete pickup and dropoff through real browser keyboard controls",
    routeState.stats.deliveries > 0,
  );
  await page.screenshot({ path: `${output}/${engine}-desktop-drive.png` });
  const profile = await page.evaluate(async () => {
    const start = performance.now(),
      ticks = window.xeom.run.tick,
      frames = [];
    let previous = performance.now();
    while (performance.now() - start < 3000) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      frames.push(now - previous);
      previous = now;
    }
    const gl = window.xeom.view.renderer.getContext(),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    frames.sort((a, b) => a - b);
    return {
      fps: 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length),
      p95: frames[Math.floor(frames.length * 0.95)],
      calls: window.xeom.view.renderer.info.render.calls,
      triangles: window.xeom.view.renderer.info.render.triangles,
      tickDelta: window.xeom.run.tick - ticks,
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
    };
  });
  report.profile = profile;
  console.log("PROFILE", JSON.stringify(profile));
  if (soak) {
    // Navigation belongs to this test driver only. Input still travels through
    // browser keys; no changes to player position, time, traffic or event deck.
    await page.evaluate(() => {
      window.soakFrames = [];
      let previous = performance.now();
      const sample = (now) => {
        window.soakFrames.push(now - previous);
        previous = now;
        if (!window.xeom.run.ended) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    const wallStart = Date.now(),
      simulationStart = await page.evaluate(() => window.xeom.run.time);
    let path = [],
      mission = "",
      lastProgress = -1;
    while (Date.now() - wallStart < 240000) {
      const s = await page.evaluate(() => ({
        p: window.xeom.run.player,
        phase: window.xeom.run.missions.phase,
        index: window.xeom.run.missions.index,
        ended: window.xeom.run.ended,
        time: window.xeom.run.time,
      }));
      if (s.ended) break;
      const key = s.index + ":" + s.phase;
      if (key !== mission || path.length === 0) {
        mission = key;
        path = await page.evaluate(async () => {
          const { surface, HIDDEN_LANES } = await import(
            new URL("./src/world/map.js", document.baseURI).href
          );
          const run = window.xeom.run,
            p = run.player,
            goal = run.missions.target;
          const nodes = [
            { x: p.x, z: p.z },
            ...[-72, -36, 0, 36, 72].flatMap((x) =>
              [-72, -36, 0, 36, 72].map((z) => ({ x, z })),
            ),
            // The authored dogleg is part of the map, beyond the old grid graph.
            ...HIDDEN_LANES.flatMap((lane) => lane.points),
            { x: goal.x, z: goal.z },
          ];
          const cost = nodes.map(() => Infinity),
            previous = nodes.map(() => -1),
            visited = new Set();
          cost[0] = 0;
          const clear = (a, b) => {
            const length = Math.hypot(a.x - b.x, a.z - b.z),
              steps = Math.ceil(length);
            for (let i = 0; i <= steps; i++) {
              const t = steps ? i / steps : 0;
              if (
                surface(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.9) ===
                "wall"
              )
                return false;
            }
            return true;
          };
          while (visited.size < nodes.length) {
            let current = -1;
            for (let i = 0; i < nodes.length; i++)
              if (!visited.has(i) && (current < 0 || cost[i] < cost[current]))
                current = i;
            if (current < 0 || !Number.isFinite(cost[current])) break;
            visited.add(current);
            if (current === nodes.length - 1) break;
            for (let i = 0; i < nodes.length; i++)
              if (!visited.has(i) && clear(nodes[current], nodes[i])) {
                const next =
                  cost[current] +
                  Math.hypot(
                    nodes[i].x - nodes[current].x,
                    nodes[i].z - nodes[current].z,
                  );
                if (next < cost[i]) {
                  cost[i] = next;
                  previous[i] = current;
                }
              }
          }
          const route = [];
          let index = nodes.length - 1;
          while (index > 0) {
            route.unshift(nodes[index]);
            index = previous[index];
            if (index < 0) throw new Error("No driveable test route");
          }
          return route;
        });
      }
      const target = path[0],
        p = s.p,
        d = Math.hypot(target.x - p.x, target.z - p.z),
        a = Math.atan2(target.x - p.x, target.z - p.z) - p.angle,
        delta = Math.atan2(Math.sin(a), Math.cos(a));
      if (path.length > 1 && d < 2.5) {
        path.shift();
        continue;
      }
      const wanted =
        path.length === 1 && d < 4
          ? 0
          : Math.abs(delta) > 0.45
            ? 0
            : d < 8
              ? 5
              : 12;
      const desired = new Set([
        ...(p.speed < wanted ? ["w"] : []),
        ...(p.speed > wanted ? ["s"] : []),
        ...(delta > 0.09 ? ["a"] : []),
        ...(delta < -0.09 ? ["d"] : []),
      ]);
      for (const key of held)
        if (!desired.has(key)) {
          await page.keyboard.up(key);
          held.delete(key);
        }
      for (const key of desired)
        if (!held.has(key)) {
          await page.keyboard.down(key);
          held.add(key);
        }
      const progress = Math.floor(s.time / 30);
      if (progress !== lastProgress) {
        console.log("SOAK", Math.round(s.time), "seconds", mission);
        lastProgress = progress;
      }
      await page.waitForTimeout(70);
    }
    for (const key of held) await page.keyboard.up(key);
    held.clear();
    const outcome = await page.evaluate(() => {
      const run = window.xeom.run,
        frames = window.soakFrames;
      frames.sort((a, b) => a - b);
      return {
        ended: run.ended,
        result: run.result(),
        time: run.time,
        chaos: run.record.events.filter((e) => e.type === "chaos"),
        fps: 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length),
        p95: frames[Math.floor(frames.length * 0.95)],
      };
    });
    report.soak = {
      ...outcome,
      wallSeconds: (Date.now() - wallStart) / 1000,
      simulationStart,
    };
    check(
      "real-time run reaches 180 seconds with all six chaos warnings",
      outcome.ended && outcome.time === 180 && outcome.chaos.length === 6,
    );
    check(
      "real-time driving completes multiple passenger trips",
      outcome.result.deliveries >= 2,
    );
    await page.screenshot({ path: `${output}/${engine}-soak-results.png` });
    await page.evaluate(() => document.getElementById("results").close());
  }
  await page.locator("#settings-open").click();
  await page.locator("#quality").selectOption("low");
  await page.locator("#motion").check();
  await page.locator("#language").selectOption("en");
  await page.locator("#settings .primary").click();
  await page.waitForFunction(
    () =>
      window.xeom.view.quality === "low" &&
      window.xeom.view.reducedMotion &&
      document.documentElement.lang === "en",
  );
  check(
    "low quality, reduced motion and English settings apply",
    await page.evaluate(
      () =>
        window.xeom.view.quality === "low" &&
        window.xeom.view.reducedMotion &&
        document.documentElement.lang === "en",
    ),
  );
  const countBefore = await page.evaluate(() => window.xeom.run.traffic.length);
  check("graphics quality preserves collision traffic", countBefore === 58);
  check(
    "inactive traffic is excluded from GPU instance counts",
    await page.evaluate(
      () =>
        window.xeom.view.trafficBatches.reduce((n, b) => n + b.count, 0) <=
        window.xeom.run.traffic.filter((v) => v.active).length,
    ),
  );

  // Finish by stepping remaining empty-input ticks through the real simulation. This is a
  // result-screen integration fixture, not a claim of a human-played 180-second session.
  if (!soak)
    await page.evaluate(() => {
      const run = window.xeom.run;
      while (run.tick < 10799) run.step();
    });
  else
    await page.evaluate(() => document.getElementById("results").showModal());
  await page.locator("#results").waitFor({ state: "visible" });
  check(
    "completed run produces result screen and local score",
    (await page.locator("#result-score").innerText()) !== "",
  );
  await page.screenshot({ path: `${output}/${engine}-results.png` });
  const cardDownload = page.waitForEvent("download");
  await page.locator("#save-card").click();
  const card = await cardDownload;
  await card.saveAs(`${output}/${engine}-result-card.png`);
  check("PNG result card downloads", card.suggestedFilename().endsWith(".png"));
  const png = await readFile(`${output}/${engine}-result-card.png`);
  check(
    "result card is a real 1080 by 1350 PNG",
    png.subarray(1, 4).toString() === "PNG" &&
      png.readUInt32BE(16) === 1080 &&
      png.readUInt32BE(20) === 1350,
  );
  const replayDownload = page.waitForEvent("download");
  await page.locator("#save-replay").click();
  const replay = await replayDownload;
  await replay.saveAs(`${output}/${engine}-run.json`);
  check(
    "versioned run data downloads",
    replay.suggestedFilename().endsWith(".json"),
  );
  const recording = JSON.parse(
    await readFile(`${output}/${engine}-run.json`, "utf8"),
  );
  check(
    "recording contains the full bounded run and matching result",
    recording.inputs.length === 10800 &&
      recording.poses.length === 1800 &&
      recording.result.seed === recording.seed &&
      recording.result.version === recording.version,
  );
  await page.locator("#share").click();
  check(
    "share has clipboard or visible URL fallback",
    (await page.locator("#share-status").innerText()).length > 0,
  );
  await page.locator("#again").click();
  check(
    "one-tap replay closes result screen",
    !(await page.locator("#results").isVisible()),
  );
  await page.waitForFunction(
    () => window.xeom.view.effects.lastTick === window.xeom.run.tick,
  );
  check(
    "restart resets particle cooldown to the new run clock",
    await page.evaluate(
      () => window.xeom.view.effects.lastSpawn <= window.xeom.run.time,
    ),
  );
  if (engine === "chromium") {
    await page.evaluate(() => {
      window.graphicsLoss = window.xeom.view.renderer
        .getContext()
        .getExtension("WEBGL_lose_context");
      window.graphicsLoss.loseContext();
    });
    await page.waitForFunction(
      () =>
        window.xeom.state.paused &&
        document.getElementById("fatal").hidden === false,
    );
    const frozenTick = await page.evaluate(() => window.xeom.run.tick);
    await page.waitForTimeout(150);
    check(
      "WebGL loss pauses mission time",
      frozenTick === (await page.evaluate(() => window.xeom.run.tick)),
    );
    await page.evaluate(() => window.graphicsLoss.restoreContext());
    await page.waitForFunction(() => document.getElementById("fatal").hidden);
    await page.locator("#resume").click();
    check(
      "WebGL restoration can resume the run",
      await page.evaluate(() => !window.xeom.state.paused),
    );
  }
  check(
    "all game requests stay on the static host",
    [...requests].every((url) => new URL(url).origin === new URL(base).origin),
  );
  if (base.includes("/dist"))
    check(
      "packaged build uses vendored Three.js",
      [...requests].some((url) => url.includes("/vendor/three.module.js")) &&
        ![...requests].some((url) => url.includes("/node_modules/")),
    );
  await context.close();

  const mobile = await browser.newContext({
    ...devices["Pixel 7"],
    acceptDownloads: true,
  });
  const touch = await mobile.newPage();
  touch.on("pageerror", (error) => report.errors.push(error.message));
  touch.on("console", (message) => {
    if (message.type() === "error") report.errors.push(message.text());
  });
  await touch.goto(base + "/?debug=1&seed=2026-09-06");
  await touch.waitForFunction(() => Boolean(window.xeom?.view));
  await touch.locator("#start").tap();
  await touch.waitForTimeout(250);
  check(
    "touch controls visible on phone",
    await touch.locator("#touch-controls").isVisible(),
  );
  check(
    "phone tutorial explains touch controls",
    (await touch.locator("#ride-hint").innerText()).includes("NÚT GA"),
  );
  const bounds = await touch.locator('[data-input="throttle"]').boundingBox();
  check(
    "thumb controls at least 44 CSS pixels",
    bounds.width >= 44 && bounds.height >= 44,
  );
  // Dispatch touch input through Chromium's input pipeline (not synthetic DOM events).
  if (engine === "chromium") {
    const cdp = await mobile.newCDPSession(touch),
      x = bounds.x + bounds.width / 2,
      y = bounds.y + bounds.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    await touch.waitForFunction(() => window.xeom.run.player.speed > 4);
    check("native touch accelerates motorcycle", true);
    const left = await touch.locator('[data-input="left"]').boundingBox();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x, y, id: 1 },
        { x: left.x + left.width / 2, y: left.y + left.height / 2, id: 2 },
      ],
    });
    await touch.waitForFunction(
      () => Math.abs(window.xeom.run.player.lean) > 0.02,
    );
    check("simultaneous touch steering and throttle", true);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    check(
      "touch cancellation releases all controls",
      await touch.evaluate(() =>
        Object.values(window.xeom.input.state).every((v) => v === false),
      ),
    );
  }
  check(
    "phone has no horizontal overflow",
    await touch.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await touch.evaluate(() => (document.getElementById("debug").hidden = true));
  await touch.screenshot({ path: `${output}/${engine}-mobile-drive.png` });
  await touch.locator("#settings-open").tap();
  await touch.locator("#left-handed").check();
  await touch.locator("#touch-scale").fill("115");
  await touch.locator("#settings .primary").tap();
  await touch.waitForFunction(() =>
    document.body.classList.contains("left-handed"),
  );
  check(
    "left-handed layout applies",
    await touch
      .locator("body")
      .evaluate((body) => body.classList.contains("left-handed")),
  );
  await touch.setViewportSize({ width: 844, height: 390 });
  await touch.screenshot({ path: `${output}/${engine}-mobile-landscape.png` });
  check(
    "landscape has no horizontal overflow",
    await touch.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await mobile.close();
  check("no blocking browser console errors", report.errors.length === 0);
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  report.finished = new Date().toISOString();
  await writeFile(
    `${output}/${engine}-qa.json`,
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
