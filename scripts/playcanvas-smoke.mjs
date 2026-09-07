import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

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
    fps: window.xeom.view.fps,
    renderer: document.documentElement.dataset.renderer,
  }));
  report.live = live;
  check(
    "PlayCanvas mode enters the same gameplay simulation",
    live.playing && live.speed > 0,
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
  await context.close();
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  report.finished = new Date().toISOString();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
