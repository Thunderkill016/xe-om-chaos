import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { Run } from "../src/game/Run.js";
import { openingRoutes } from "./evaluate-routes.mjs";
import {
  REAL_HCM_CORRIDOR,
  REAL_HCM_CORRIDOR_STOPS,
} from "../src/world/HcmCorridor.js";

const output = process.env.XEOM_OUTPUT || "output/core-driving";
const base = (process.env.XEOM_URL || "http://127.0.0.1:4173").replace(
  /\/$/,
  "",
);
await mkdir(output, { recursive: true });

const report = {
  started: new Date().toISOString(),
  base,
  checks: [],
  errors: [],
};

function check(name, value) {
  assert.ok(value, name);
  report.checks.push(name);
  console.log("PASS", name);
}

async function syncKeys(page, held, desired) {
  for (const key of [...held]) {
    if (!desired.has(key)) {
      await page.keyboard.up(key);
      held.delete(key);
    }
  }
  for (const key of desired) {
    if (!held.has(key)) {
      await page.keyboard.down(key);
      held.add(key);
    }
  }
}

async function releaseKeys(page, held) {
  for (const key of held) await page.keyboard.up(key);
  held.clear();
}

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.push(message.text());
  });

  await page.goto(`${base}/?debug=1&seed=2026-09-06`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => Boolean(window.xeom?.view));
  report.version = await page.evaluate(() => window.xeom.run.record.version);
  const vietnameseStart = (await page.locator("#start").textContent())?.trim();
  check(
    "Vietnamese edition declares Vietnamese and exposes one start action",
    (await page.locator("html").getAttribute("lang")) === "vi" &&
      Boolean(vietnameseStart),
  );
  await page.evaluate(() => {
    document.getElementById("debug").hidden = true;
  });
  await page.screenshot({ path: `${output}/menu.png` });

  await page.locator("#start").click();
  check(
    "start enters live gameplay",
    (await page.locator("#timer").isVisible()) &&
      (await page.evaluate(() => window.xeom.state.playing)),
  );

  await page.keyboard.down("w");
  await page.waitForFunction(() => window.xeom.run.player.speed > 5);
  check("throttle accelerates motorcycle", true);

  await page.keyboard.down("a");
  await page.waitForFunction(
    () => Math.abs(window.xeom.run.player.lean) > 0.03,
  );
  check("steering produces visible bike lean", true);
  await page.keyboard.up("a");
  await page.keyboard.up("w");

  await page.keyboard.down("s");
  await page.waitForFunction(() => window.xeom.run.player.speed === 0);
  await page.keyboard.up("s");
  check("brake stops motorcycle", true);

  await page.locator("#pause").click();
  await page.locator("#restart-pause").click();
  check(
    "restart resets crash and score state",
    await page.evaluate(
      () =>
        window.xeom.run.stats.crashes === 0 &&
        window.xeom.run.stats.score === 0,
    ),
  );

  const route = openingRoutes(new Run("2026-09-06")).hem26;
  let waypoint = 0;
  const held = new Set();
  const routeStart = Date.now();

  while (Date.now() - routeStart < 80000) {
    const state = await page.evaluate(() => ({
      p: window.xeom.run.player,
      phase: window.xeom.run.missions.phase,
      deliveries: window.xeom.run.stats.deliveries,
    }));
    if (state.deliveries > 0 || waypoint >= route.length) break;

    const target = route[waypoint];
    const p = state.p;
    const distance = Math.hypot(target.x - p.x, target.z - p.z);
    const targetAngle = Math.atan2(target.x - p.x, target.z - p.z) - p.angle;
    const delta = Math.atan2(Math.sin(targetAngle), Math.cos(targetAngle));

    if (
      (!target.stop && distance < 3) ||
      (waypoint === 0 && state.phase === "dropoff")
    ) {
      waypoint += 1;
      continue;
    }

    const wantedSpeed =
      target.stop && distance < 4
        ? 0
        : Math.abs(delta) > 0.5
          ? 0
          : distance < 8
            ? 4
            : 8;

    const desired = new Set([
      ...(p.speed < wantedSpeed ? ["w"] : []),
      ...(p.speed > wantedSpeed ? ["s"] : []),
      ...(delta > 0.1 ? ["a"] : []),
      ...(delta < -0.1 ? ["d"] : []),
    ]);
    await syncKeys(page, held, desired);
    await page.waitForTimeout(80);
  }
  await releaseKeys(page, held);

  const outcome = await page.evaluate(() => ({
    deliveries: window.xeom.run.stats.deliveries,
    crashes: window.xeom.run.stats.crashes,
    alleys: window.xeom.run.stats.alleys,
    discoveredHem26: window.xeom.run.discoveredLanes.has("hem26"),
    time: window.xeom.run.time,
    player: {
      x: window.xeom.run.player.x,
      z: window.xeom.run.player.z,
      speed: window.xeom.run.player.speed,
    },
  }));
  report.route = outcome;

  check(
    "Hẻm 26 is discovered through real browser steering",
    outcome.discoveredHem26,
  );
  check(
    "pickup and dropoff complete through real browser controls",
    outcome.deliveries > 0,
  );
  check(
    "browser reports no blocking console errors",
    report.errors.length === 0,
  );
  await page.screenshot({ path: `${output}/after-route.png` });

  const corridorSetup = await page.evaluate((stops) => {
    const start = stops[0];
    const end = stops[1];
    const p = window.xeom.run.player;
    p.x = start.x;
    p.z = start.z;
    p.speed = 0;
    p.vx = 0;
    p.vz = 0;
    p.immune = 3;
    p.angle = Math.atan2(end.x - start.x, end.z - start.z);
    window.xeom.run.director.update = () => {};
    return {
      start,
      end,
      phase: window.xeom.run.missions.phase,
      pickup: window.xeom.run.missions.pickup,
      destination: window.xeom.run.missions.destination,
      corridorStats: window.xeom.view.realHcmCorridorStats,
      corridorTraffic: window.xeom.run.traffic.filter(
        (vehicle) => vehicle.route === "hcm-osm-corridor-1",
      ).length,
    };
  }, REAL_HCM_CORRIDOR_STOPS);
  report.corridor = corridorSetup;

  check(
    "playable HCMC OSM corridor is rendered with real source geometry",
    corridorSetup.corridorStats?.source === "OpenStreetMap" &&
      corridorSetup.corridorStats.gameLength > 20,
  );
  check(
    "second trip promotes the real HCMC corridor pickup",
    corridorSetup.phase === "pickup" &&
      Math.hypot(
        corridorSetup.pickup.x - corridorSetup.start.x,
        corridorSetup.pickup.z - corridorSetup.start.z,
      ) < 0.5,
  );
  check(
    "live traffic is assigned to the HCMC OSM corridor",
    corridorSetup.corridorTraffic >= 2,
  );

  await page.waitForFunction(
    () => window.xeom.run.missions.phase === "dropoff",
    null,
    { timeout: 4000 },
  );
  check("corridor pickup boards through the normal stop dwell rule", true);

  const corridorPoints = REAL_HCM_CORRIDOR.points.map(({ x, z }) => ({ x, z }));
  let corridorWaypoint = 1;
  let midpointCaptured = false;
  const corridorHeld = new Set();
  const corridorStartTime = Date.now();
  const corridorDeliveriesBefore = await page.evaluate(
    () => window.xeom.run.stats.deliveries,
  );

  while (Date.now() - corridorStartTime < 70000) {
    const state = await page.evaluate(() => ({
      p: window.xeom.run.player,
      deliveries: window.xeom.run.stats.deliveries,
    }));
    if (state.deliveries > corridorDeliveriesBefore) break;
    if (corridorWaypoint >= corridorPoints.length) {
      const end = REAL_HCM_CORRIDOR_STOPS[1];
      const distanceToEnd = Math.hypot(end.x - state.p.x, end.z - state.p.z);
      const desired = new Set(state.p.speed > 0.2 || distanceToEnd < 4 ? ["s"] : []);
      await syncKeys(page, corridorHeld, desired);
      await page.waitForTimeout(80);
      continue;
    }

    const target = corridorPoints[corridorWaypoint];
    const p = state.p;
    const distance = Math.hypot(target.x - p.x, target.z - p.z);
    const targetAngle = Math.atan2(target.x - p.x, target.z - p.z) - p.angle;
    const delta = Math.atan2(Math.sin(targetAngle), Math.cos(targetAngle));
    if (distance < 2.4) {
      corridorWaypoint += 1;
      continue;
    }

    const finalSegment = corridorWaypoint >= corridorPoints.length - 1;
    const wantedSpeed =
      finalSegment && distance < 5
        ? 0
        : Math.abs(delta) > 0.55
          ? 1.5
          : Math.abs(delta) > 0.3
            ? 4.5
            : 7;
    const desired = new Set([
      ...(p.speed < wantedSpeed ? ["w"] : []),
      ...(p.speed > wantedSpeed + 0.8 ? ["s"] : []),
      ...(delta > 0.075 ? ["a"] : []),
      ...(delta < -0.075 ? ["d"] : []),
    ]);
    await syncKeys(page, corridorHeld, desired);

    if (!midpointCaptured && corridorWaypoint >= corridorPoints.length / 2) {
      await page.evaluate(() => {
        document.getElementById("reaction").textContent = "";
      });
      await page.waitForTimeout(120);
      await page.screenshot({ path: `${output}/hcm-corridor-mid.png` });
      midpointCaptured = true;
    }
    await page.waitForTimeout(80);
  }
  await releaseKeys(page, corridorHeld);

  const corridorOutcome = await page.evaluate((end) => {
    const p = window.xeom.run.player;
    return {
      deliveries: window.xeom.run.stats.deliveries,
      crashes: window.xeom.run.stats.crashes,
      distanceToEnd: Math.hypot(end.x - p.x, end.z - p.z),
      player: { x: p.x, z: p.z, speed: p.speed },
      activeCorridorTraffic: window.xeom.run.traffic.filter(
        (vehicle) => vehicle.active && vehicle.route === "hcm-osm-corridor-1",
      ).length,
    };
  }, REAL_HCM_CORRIDOR_STOPS[1]);
  report.corridorOutcome = corridorOutcome;

  check(
    "browser controls drive the motorcycle across the playable HCMC corridor",
    corridorOutcome.distanceToEnd < 5.5,
  );
  check(
    "corridor trip completes through the normal delivery rule",
    corridorOutcome.deliveries > corridorDeliveriesBefore,
  );
  check(
    "corridor keeps live bidirectional traffic during the drive",
    corridorOutcome.activeCorridorTraffic >= 2,
  );
  check(
    "corridor drive adds no blocking console errors",
    report.errors.length === 0,
  );

  await page.evaluate(() => {
    document.getElementById("reaction").textContent = "";
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${output}/hcm-corridor.png` });
  await context.close();

  const internationalContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const international = await internationalContext.newPage();
  const internationalErrors = [];
  international.on("pageerror", (error) =>
    internationalErrors.push(error.message),
  );
  international.on("console", (message) => {
    if (message.type() === "error") internationalErrors.push(message.text());
  });
  await international.goto(`${base}/en/?seed=2026-09-06`, {
    waitUntil: "networkidle",
  });
  const englishStart = (
    await international.locator("#start").textContent()
  )?.trim();
  check(
    "international edition is a separate English entry point",
    (await international.locator("html").getAttribute("lang")) === "en" &&
      Boolean(englishStart) &&
      englishStart !== vietnameseStart,
  );
  await international.locator("#start").click();
  check(
    "international edition enters gameplay without runtime errors",
    (await international.locator("#timer").isVisible()) &&
      internationalErrors.length === 0,
  );
  await international.screenshot({ path: `${output}/international.png` });
  report.internationalErrors = internationalErrors;
  await internationalContext.close();
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  report.finished = new Date().toISOString();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
