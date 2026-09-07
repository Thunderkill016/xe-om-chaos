import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Run } from "../src/game/Run.js";
import { PASSENGERS } from "../src/game/Missions.js";
import { CHAOS } from "../src/game/ChaosDirector.js";
import { getMissionGuidance } from "../src/platform/UI.js";

test("Vietnamese copy uses app-driver vocabulary", async () => {
  const html = await readFile("index.html", "utf8");
  for (const phrase of [
    "App vừa nổ cuốc",
    "Bác tài chạy app",
    "điểm đón",
    "trả đúng điểm",
    "cuốc kế",
  ])
    assert.match(html, new RegExp(phrase, "i"));

  const run = new Run("copy-voice");
  run.stats.distance = 10;
  const pickup = getMissionGuidance(run, "vi");
  assert.match(pickup.phase, /Bác tài/i);
  assert.match(pickup.phase, /điểm đón/i);
  assert.match(pickup.hint, /Cuốc vừa nổ/i);

  run.missions.phase = "dropoff";
  run.missions.deadline = 20;
  const dropoff = getMissionGuidance(run, "vi");
  assert.match(dropoff.phase, /Bác tài/i);
  assert.match(dropoff.phase, /điểm trả/i);
  assert.match(dropoff.hint, /Khách đã lên xe/i);
});

test("passengers and street events identify a subject", () => {
  for (const passenger of PASSENGERS) {
    assert.match(passenger.line, /[.!?]/);
    assert.match(passenger.line, /(anh|em|cô|con)/i);
  }

  for (const event of CHAOS) {
    assert.match(event.vi, /[.!?]/);
    assert.match(
      event.vi,
      /Bác tài|Trời Sài Gòn|Giờ tan tầm|Đoạn phía trước|Đường phía trước|Xe buýt|Đường Bến Gió/i,
    );
  }
});
