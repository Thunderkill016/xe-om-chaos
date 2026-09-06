import { CONFIG, clamp, distance, angleDelta } from "../game/config.js";
import { AVENUES, ALLEYS, HIDDEN_LANES, district } from "../world/map.js";
import { PASSENGERS } from "../game/Missions.js";
import { CHAOS } from "../game/ChaosDirector.js";

const APPROACH_DISTANCE = 13;
const FIRST_MOVEMENT_DISTANCE = 3;
const PASSENGER_PREFERENCES = {
  office: ["THƯỞNG · ĐẾN SỚM", "BONUS · ARRIVE EARLY"],
  grandma: ["THƯỞNG · CHẠY ÊM", "BONUS · RIDE SMOOTHLY"],
  student: ["THƯỞNG · ĐI XUYÊN HẺM", "BONUS · TAKE AN ALLEY"],
  chaos: ["THƯỞNG · LÁCH XE AN TOÀN", "BONUS · SAFE CLOSE PASSES"],
};

export function getMissionGuidance(run, language = "vi", touch = false) {
  const text = (vi, en) => (language === "en" ? en : vi);
  const mission = run.missions;
  const pickup = mission.phase === "pickup";
  const targetDistance = distance(run.player, mission.target);
  const inside = targetDistance < CONFIG.stopRadius;
  const slowEnough = Math.abs(run.player.speed) < CONFIG.stopSpeed;
  const overdue = !pickup && mission.deadline < 0;
  let stage = "route";
  let hint = text(
    "Đường lớn hay hẻm? Bạn chọn.",
    "Boulevard or hẻm? Your call.",
  );

  if (run.player.recovery > 0) {
    stage = "recovery";
    hint = text(
      "BÌNH TĨNH · XE ĐANG HỒI PHỤC",
      "EASY · YOUR BIKE IS RECOVERING",
    );
  } else if (inside && slowEnough) {
    stage = "boarding";
    hint = pickup
      ? text("GIỮ PHANH · KHÁCH ĐANG LÊN XE", "HOLD BRAKE · PASSENGER BOARDING")
      : text(
          "GIỮ PHANH · KHÁCH ĐANG XUỐNG XE",
          "HOLD BRAKE · PASSENGER GETTING OFF",
        );
  } else if (targetDistance < APPROACH_DISTANCE) {
    stage = "brake";
    hint = pickup
      ? text(
          "↓ PHANH TRONG VÒNG VÀNG ĐỂ ĐÓN KHÁCH",
          "↓ BRAKE IN THE YELLOW RING TO PICK UP",
        )
      : text(
          "↓ PHANH TRONG VÒNG XANH ĐỂ TRẢ KHÁCH",
          "↓ BRAKE IN THE GREEN RING TO DROP OFF",
        );
  } else if (run.stats.distance < FIRST_MOVEMENT_DISTANCE) {
    stage = "depart";
    hint = touch
      ? text(
          "GIỮ NÚT GA ↑ · CHẠM ←/→ ĐỂ RẼ",
          "HOLD ↑ TO GO · TOUCH ←/→ TO STEER",
        )
      : text(
          "GIỮ GA W / ↑ · A/D để rẽ · S để phanh",
          "HOLD W / ↑ · A/D steer · S brake",
        );
  } else if (overdue) {
    stage = "overdue";
    hint = text(
      "HẾT THƯỞNG GIỜ · VẪN TRẢ KHÁCH ĐƯỢC",
      "TIME BONUS ENDED · YOU CAN STILL DROP OFF",
    );
  }

  const preference = PASSENGER_PREFERENCES[mission.passenger.id];
  return {
    stage,
    hint,
    phase: pickup
      ? text("ĐÓN KHÁCH · VÒNG VÀNG", "PICK UP · YELLOW RING")
      : text("TRẢ KHÁCH · VÒNG XANH", "DROP OFF · GREEN RING"),
    preference: text(preference[0], preference[1]),
    deadline: pickup
      ? ""
      : overdue
        ? text("QUÁ GIỜ", "LATE")
        : Math.ceil(mission.deadline) + " s",
    showProgress: inside && run.player.recovery === 0,
    progress:
      inside && slowEnough
        ? clamp(mission.dwell / CONFIG.boardingSeconds, 0, 1)
        : 0,
    progressLabel: pickup
      ? text("Tiến độ đón khách", "Pickup progress")
      : text("Tiến độ trả khách", "Drop-off progress"),
  };
}

/** @returns {any} */
export const el = (id) => document.getElementById(id);
export class UI {
  constructor(seed) {
    this.seed = seed;
    this.language = "vi";
    this.reactionUntil = 0;
    this.lastHud = 0;
    this.storageAvailable = true;
    this.map = /** @type {CanvasRenderingContext2D} */ (
      el("minimap").getContext("2d")
    );
    const saved = this.read("xoc:settings", {});
    this.prefs =
      saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    this.language = this.prefs.language === "en" ? "en" : "vi";
    this.localize();
    el("language").value = this.language;
    el("daily-label").textContent = "DAILY RUN / " + seed + " UTC";
    const best = this.read(this.bestKey(), 0);
    el("welcome-best").textContent = best
      ? this.t("KỶ LỤC HÔM NAY · ", "TODAY’S BEST · ") + best.toLocaleString()
      : this.t("KHÔNG TÀI KHOẢN. CỨ THẾ MÀ ĐI.", "NO ACCOUNT. JUST RIDE.");
  }
  t(vi, en) {
    return this.language === "vi" ? vi : en;
  }
  localize() {
    document.documentElement.lang = this.language;
    document.querySelectorAll("[data-vi]").forEach((node) => {
      if (node instanceof HTMLElement)
        node.textContent = (node.dataset[this.language] || "").replaceAll(
          "\\n",
          "\n",
        );
    });
  }
  bestKey() {
    return "xoc:best:" + CONFIG.version + ":" + this.seed;
  }
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      this.storageAvailable = false;
      return fallback;
    }
  }
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      this.storageAvailable = false;
      return false;
    }
  }
  begin() {
    document.body.classList.add("playing");
    el("welcome").hidden = true;
    el("postcard").hidden = true;
    el("footer").hidden = true;
    el("hud").hidden = false;
    el("pause").hidden = false;
    this.reactionUntil = 0;
    el("reaction").textContent = "";
  }
  event(event, time) {
    if (event.type === "reply" || event.type === "horn" || event.type === "end")
      return;
    const suffix =
      event.type === "delivery"
        ? "\n+" + event.value.toLocaleString() + " ₫"
        : event.value
          ? " +" + event.value
          : "";
    let text = event.text;
    if (this.language === "en") {
      const passenger = PASSENGERS.find((p) => p.line === text);
      const chaos = CHAOS.find((e) => e.vi === text);
      if (passenger) text += "\n" + passenger.subtitle;
      else if (chaos) text = chaos.en;
      else if (event.type === "delivery") text = "MADE IT!";
      else if (event.type === "crash") text = "ỦA?! / WHOOPS!";
      else if (event.type === "discovery") text = "FOUND HẺM 26!";
      else if (event.type === "thread") text = "THREADED! +BOOST";
    }
    el("reaction").textContent = text + suffix;
    el("reaction").dataset.event = event.type;
    this.reactionUntil = time + 2.3;
  }
  update(run, view, now) {
    if (now - this.lastHud < 0.08) return;
    this.lastHud = now;
    const p = run.player,
      m = run.missions;
    const remaining = Math.max(0, Math.ceil(CONFIG.runSeconds - run.time));
    el("timer").textContent =
      Math.floor(remaining / 60) +
      ":" +
      String(remaining % 60).padStart(2, "0");
    el("score").textContent = run.stats.score.toLocaleString();
    el("fare").textContent = run.stats.money.toLocaleString() + " ₫";
    el("speed").textContent = Math.round(p.speed * 3.6);
    el("combo").textContent = "×" + run.flow.combo;
    el("flow-meter").style.transform = "scaleX(" + run.flow.energy + ")";
    el("boost-meter").style.transform = "scaleX(" + p.boost + ")";
    const guidance = getMissionGuidance(
      run,
      this.language,
      matchMedia("(pointer: coarse)").matches,
    );
    el("mission-card").dataset.phase = m.phase;
    el("mission-phase").textContent = guidance.phase;
    el("destination").textContent = m.target.name;
    el("mission-detail").textContent =
      this.t(m.passenger.vi, m.passenger.en) +
      " · " +
      Math.round(distance(p, m.target)) +
      " m" +
      (guidance.deadline ? " · " + guidance.deadline : "");
    el("passenger-preference").textContent = guidance.preference;
    el("boarding-progress").hidden = !guidance.showProgress;
    el("boarding-progress").value = guidance.progress;
    el("boarding-progress").setAttribute("aria-label", guidance.progressLabel);
    const angle = Math.atan2(m.target.x - p.x, m.target.z - p.z);
    el("direction").style.transform =
      "rotate(" + -angleDelta(angle, p.angle) + "rad)";
    el("district").textContent = district(p.x, p.z);
    el("chaos").textContent =
      this.language === "en"
        ? CHAOS.find((e) => e.vi === run.eventName)?.en || ""
        : run.eventName;
    if (run.time > this.reactionUntil) el("reaction").textContent = "";
    el("ride-hint").dataset.stage = guidance.stage;
    el("ride-hint").textContent = guidance.hint;
    this.drawMap(run);
    if (!el("debug").hidden)
      el("debug").textContent =
        `${view.fps.toFixed(1)} FPS · ${view.frameMs.toFixed(1)} ms\n${view.renderer.info.render.calls} calls · ${view.renderer.info.render.triangles} triangles\n${run.traffic.filter((v) => v.active).length} vehicles · ${view.effects.particleLife.filter((life) => life > 0).length} particles · DPR ${view.ratio.toFixed(2)}\ntick ${run.tick} · ${run.seed}\nx ${p.x.toFixed(1)} z ${p.z.toFixed(1)} θ ${p.angle.toFixed(2)}`;
  }
  drawMap(run) {
    const ctx = this.map;
    ctx.clearRect(0, 0, 200, 200);
    ctx.fillStyle = "#254647";
    ctx.fillRect(0, 0, 200, 200);
    ctx.strokeStyle = "#77928a";
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (const v of AVENUES) {
      ctx.moveTo(v + 100, 11);
      ctx.lineTo(v + 100, 189);
      ctx.moveTo(11, v + 100);
      ctx.lineTo(189, v + 100);
    }
    ctx.stroke();
    ctx.strokeStyle = "#537971";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const v of ALLEYS) {
      ctx.moveTo(v + 100, 28);
      ctx.lineTo(v + 100, 172);
      ctx.moveTo(28, v + 100);
      ctx.lineTo(172, v + 100);
    }
    ctx.stroke();
    ctx.strokeStyle = "#85b7a0";
    ctx.lineWidth = 3;
    for (const lane of HIDDEN_LANES) {
      ctx.beginPath();
      lane.points.forEach((p, i) =>
        i ? ctx.lineTo(p.x + 100, p.z + 100) : ctx.moveTo(p.x + 100, p.z + 100),
      );
      ctx.stroke();
    }
    ctx.fillStyle = "#3d7b80";
    ctx.fillRect(190, 0, 10, 200);
    const director = run.director;
    if (director.active.has("flood")) {
      ctx.fillStyle = "#63aaa5";
      ctx.fillRect(165, 118, 14, 69);
    }
    for (const obstacle of [director.barrier, director.bus])
      if (obstacle.active) {
        ctx.fillStyle = "#ff9862";
        ctx.fillRect(
          obstacle.x + 100 - obstacle.w / 2,
          obstacle.z + 100 - obstacle.d / 2,
          obstacle.w,
          obstacle.d + 1,
        );
      }
    if (director.active.has("potholes"))
      for (const hole of director.potholes) {
        ctx.fillStyle = "#ffcb72";
        ctx.fillRect(hole.x + 98, hole.z + 98, 4, 4);
      }
    for (const v of run.traffic)
      if (v.active) {
        ctx.fillStyle = "#d9bd92";
        ctx.fillRect(v.x + 99, v.z + 99, 2, 2);
      }
    ctx.fillStyle = run.missions.phase === "pickup" ? "#ffcd6d" : "#85f3c5";
    ctx.beginPath();
    ctx.arc(
      run.missions.target.x + 100,
      run.missions.target.z + 100,
      5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    const p = run.player;
    ctx.save();
    ctx.translate(p.x + 100, p.z + 100);
    ctx.rotate(-p.angle);
    ctx.fillStyle = "#fff6da";
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-4, -4);
    ctx.lineTo(4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  finish(run) {
    const result = run.result(),
      best = Number(this.read(this.bestKey(), 0)) || 0;
    const saved =
      result.score > best
        ? this.write(this.bestKey(), result.score)
        : this.storageAvailable;
    el("result-title").textContent = result.title;
    el("result-score").textContent = result.score.toLocaleString();
    el("best-message").textContent = !saved
      ? this.t(
          "Không lưu được kỷ lục · vẫn có thể lưu ảnh",
          "Storage unavailable · you can still save the card",
        )
      : result.score > best
        ? this.t("KỶ LỤC MỚI TRÊN MÁY NÀY ✦", "NEW BEST ON THIS DEVICE ✦")
        : this.t("KỶ LỤC TRÊN MÁY NÀY · ", "BEST ON THIS DEVICE · ") +
          best.toLocaleString();
    el("result-grid").replaceChildren();
    for (const [label, value] of [
      [this.t("TIỀN CƯỚC", "FARES"), result.money.toLocaleString() + " ₫"],
      ["FLOW", "×" + result.bestCombo],
      [this.t("LÁCH XE", "NEAR MISSES"), result.nearMisses],
      [this.t("CHUYẾN XE", "DELIVERIES"), result.deliveries],
      [this.t("QUÃNG ĐƯỜNG", "DISTANCE"), Math.round(result.distance) + " m"],
      [this.t("VA CHẠM", "CRASHES"), result.crashes],
    ]) {
      const item = document.createElement("div"),
        strong = document.createElement("strong"),
        small = document.createElement("small");
      strong.textContent = String(value);
      small.textContent = String(label);
      item.append(strong, small);
      el("result-grid").append(item);
    }
    el("challenge-code").textContent =
      CONFIG.version +
      " · " +
      run.seed +
      " UTC · " +
      this.t("Điểm cục bộ", "Local score");
    el("results").showModal();
  }
}
