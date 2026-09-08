import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { REAL_HCM_CORRIDOR_STOPS } from "../src/world/HcmCorridor.js";

const output = process.env.XEOM_OUTPUT || "output/playcanvas";
const base = (process.env.XEOM_URL || "http://127.0.0.1:4173").replace(
  /\/$/,
  "",
);
await mkdir(output, { recursive: true });

const report = { started: new Date().toISOString(), checks: [], errors: [] };
const check = (name, value) => {
  assert.ok(value, name);
  report.checks.push(name);
  console.log("PASS", name);
};

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.push(message.text());
  });

  await page.goto(`${base}/?debug=1&seed=2026-09-06&renderer=playcanvas`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(
    () => window.xeom?.view?.rendererKind === "playcanvas",
    null,
    {
      timeout: 15000,
    },
  );

  const boot = await page.evaluate(() => ({
    renderer: window.xeom.view.rendererKind,
    slice: window.xeom.view.realHcmCorridorStats?.verticalSlice,
    source: window.xeom.view.realHcmCorridorStats?.source,
    baseStats: window.xeom.view.authoredBaseMapStats,
    baseMap: Boolean(window.xeom.view.app.root.findByName("AUTHORED_BASE_MAP")),
    hem26: Boolean(window.xeom.view.app.root.findByName("HEM_26_PLAYCANVAS")),
    benThanh: Boolean(window.xeom.view.app.root.findByName("CHO_BEN_THANH")),
    cityHall: Boolean(
      window.xeom.view.app.root.findByName("SAIGON_CITY_HALL_SILHOUETTE"),
    ),
    fatal: !document.getElementById("fatal").hidden,
  }));
  report.boot = boot;
  check(
    "PlayCanvas renderer boots as an opt-in engine",
    boot.renderer === "playcanvas",
  );
  check(
    "PlayCanvas renders the authored gameplay map around the player origin",
    boot.baseMap && boot.baseStats?.buildings > 0,
  );
  check("Hẻm 26 exists in the PlayCanvas gameplay world", boot.hem26);
  check(
    "PlayCanvas scene uses the Bến Thành → Lê Lợi → Nguyễn Huệ vertical slice",
    boot.slice?.includes("BẾN THÀNH") && boot.source?.includes("OpenStreetMap"),
  );
  check("Bến Thành landmark exists in the PlayCanvas hierarchy", boot.benThanh);
  check(
    "Nguyễn Huệ / City Hall anchor exists in the PlayCanvas hierarchy",
    boot.cityHall,
  );
  check("PlayCanvas boot exposes no fatal overlay", !boot.fatal);

  await page.evaluate(() => {
    document.getElementById("debug").hidden = true;
  });
  await page.screenshot({ path: `${output}/playcanvas-menu.png` });

  await page.locator("#start").click();
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.xeom.run.player.speed > 3, null, {
    timeout: 8000,
  });
  await page.waitForTimeout(600);
  await page.keyboard.up("w");

  const live = await page.evaluate(() => ({
    playing: window.xeom.state.playing,
    speed: window.xeom.run.player.speed,
    player: {
      x: window.xeom.run.player.x,
      z: window.xeom.run.player.z,
    },
    baseMap: Boolean(window.xeom.view.app.root.findByName("AUTHORED_BASE_MAP")),
    fps: window.xeom.view.fps,
    renderer: document.documentElement.dataset.renderer,
  }));
  report.live = live;
  check(
    "PlayCanvas mode enters the same gameplay simulation",
    live.playing && live.speed > 0,
  );
  check(
    "PlayCanvas keeps the authored map mounted while the player moves",
    live.baseMap &&
      Number.isFinite(live.player.x) &&
      Number.isFinite(live.player.z),
  );
  check(
    "PlayCanvas mode keeps the renderer selection visible to diagnostics",
    live.renderer === "playcanvas",
  );
  check(
    "PlayCanvas browser run reports no blocking console errors",
    report.errors.length === 0,
  );

  await page.screenshot({ path: `${output}/playcanvas-live.png` });

  const corridorEvidence = await page.evaluate((stops) => {
    const start = stops[0];
    const end = stops[1];
    const p = window.xeom.run.player;
    p.x = start.x;
    p.z = start.z;
    p.vx = 0;
    p.vz = 0;
    p.speed = 0;
    p.angle = Math.atan2(end.x - start.x, end.z - start.z);
    return {
      x: p.x,
      z: p.z,
      targetDistance: Math.hypot(end.x - p.x, end.z - p.z),
      benThanh: Boolean(window.xeom.view.app.root.findByName("CHO_BEN_THANH")),
      cityHall: Boolean(
        window.xeom.view.app.root.findByName("SAIGON_CITY_HALL_SILHOUETTE"),
      ),
    };
  }, REAL_HCM_CORRIDOR_STOPS);
  await page.waitForTimeout(350);
  report.corridorEvidence = corridorEvidence;
  check(
    "PlayCanvas visual evidence can be framed from the real Bến Thành corridor",
    corridorEvidence.targetDistance > 10 &&
      corridorEvidence.benThanh &&
      corridorEvidence.cityHall,
  );
  await page.screenshot({ path: `${output}/playcanvas-hcm-corridor.png` });

  await context.close();
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  report.finished = new Date().toISOString();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
