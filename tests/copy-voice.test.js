import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Run } from "../src/game/Run.js";
import { PASSENGERS } from "../src/game/Missions.js";
import { CHAOS } from "../src/game/ChaosDirector.js";
import { getMissionGuidance } from "../src/platform/UI.js";

test("Vietnamese copy separates app voice from rider slang", async () => {
  const html = await readFile("index.html", "utf8");
  for (const phrase of [
    "App vừa phát cuốc",
    "NHẬN CUỐC",
    "điểm đón",
    "điểm trả",
    "đứng điểm",
    "nổ cuốc",
  ])
    assert.match(html, new RegExp(phrase, "i"));

  const run = new Run("copy-voice");
  run.stats.distance = 10;
  const pickup = getMissionGuidance(run, "vi");
  assert.match(pickup.phase, /Đang tới điểm đón/i);
  assert.match(pickup.hint, /App đã nhận cuốc/i);
  assert.doesNotMatch(pickup.phase + pickup.hint, /Bác tài/i);

  run.missions.phase = "dropoff";
  run.missions.deadline = 20;
  const dropoff = getMissionGuidance(run, "vi");
  assert.match(dropoff.phase, /Đang chở khách tới điểm trả/i);
  assert.match(dropoff.hint, /Khách đã lên xe/i);
  assert.doesNotMatch(dropoff.phase + dropoff.hint, /Bác tài/i);
});

test("passengers keep character voice while street events describe the world", () => {
  for (const passenger of PASSENGERS) {
    assert.match(passenger.line, /[.!?]/);
    assert.match(passenger.line, /(anh|em|cô|con)/i);
  }

  for (const event of CHAOS) {
    assert.match(event.vi, /[.!?]/);
    assert.doesNotMatch(event.vi, /Bác tài|tài xế/i);
    assert.match(
      event.vi,
      /Mưa Sài Gòn|Giờ tan tầm|Đoạn đường|rào chắn|Xe buýt|Đường Bến Gió/i,
    );
  }
});
