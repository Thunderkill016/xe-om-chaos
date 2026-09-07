import { CONFIG, dailySeed, validSeed } from "./game/config.js";
import { Run } from "./game/Run.js";
import { Scene } from "./view/Scene.js";
import { addDowntownCinematic } from "./view/Downtown.js";
import { addRealHcmContext } from "./view/OsmContext.js";
import { Input } from "./platform/Input.js";
import { Audio } from "./platform/Audio.js";
import { UI, el } from "./platform/UI.js";
import { bindShare } from "./platform/Share.js";
import { trafficPose } from "./world/map.js";

const params = new URLSearchParams(location.search);
const requested = params.get("seed");
const seed = validSeed(requested) ? requested : dailySeed();
const ui = new UI(seed),
  input = new Input(),
  audio = new Audio();
if (params.has("v") && params.get("v") !== CONFIG.version) {
  el("start").disabled = true;
  el("welcome-best").textContent = ui.t(
    "Mã thách đấu này thuộc bản game khác. Về trang chính để chạy cuốc hôm nay.",
    "This challenge was made on a different game version. Head home for today’s run.",
  );
}
let run = new Run(seed),
  view;
let playing = false,
  paused = false,
  accumulator = 0,
  previous = performance.now();
let menuTime = 0;
try {
  view = new Scene(el("game"));
  addDowntownCinematic(view);
  addRealHcmContext(view);
} catch (error) {
  el("fatal").hidden = false;
  el("fatal").textContent = ui.t(
    "Trình duyệt chưa chạy được WebGL 2. Bật tăng tốc phần cứng rồi tải lại trang.",
    "WebGL 2 could not start. Enable hardware acceleration, then reload the page.",
  );
  console.error(error);
}

async function begin() {
  document.querySelectorAll("dialog[open]").forEach((dialog) => {
    if (dialog instanceof HTMLDialogElement) dialog.close();
  });
  run = new Run(seed);
  playing = true;
  paused = false;
  accumulator = 0;
  input.reset();
  ui.begin();
  try {
    await audio.start();
  } catch (error) {
    el("sound").textContent = "×♫";
    el("sound").title = String(error);
  }
}
function pause() {
  if (!playing || paused || run.ended) return;
  paused = true;
  input.reset();
  accumulator = 0;
  el("pause-dialog").showModal();
}
el("start").onclick = begin;
el("again").onclick = begin;
el("restart-pause").onclick = begin;
bindShare(() => run, ui);
el("pause").onclick = pause;
el("resume").onclick = () => {
  paused = false;
  el("pause-dialog").close();
  input.reset();
};
el("pause-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  paused = false;
  el("pause-dialog").close();
});
el("results").addEventListener("cancel", (event) => event.preventDefault());
el("settings-open").onclick = () => {
  paused = true;
  input.reset();
  el("settings").showModal();
};
el("settings").addEventListener("close", () => {
  paused = false;
  input.reset();
  saveSettings();
});
function saveSettings() {
  const prefs = {
    volume: Number(el("volume").value) / 100,
    quality: el("quality").value,
    motion: el("motion").checked,
    leftHanded: el("left-handed").checked,
    scale: Number(el("touch-scale").value) / 100,
  };
  ui.write("xoc:settings", prefs);
  applySettings(prefs);
}
function applySettings(prefs) {
  audio.level(prefs.volume ?? 0.45, audio.muted);
  if (view) {
    view.setQuality(prefs.quality || "auto");
    view.reducedMotion =
      prefs.motion ?? matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  document.body.classList.toggle(
    "reduced-motion",
    view?.reducedMotion || false,
  );
  document.body.classList.toggle("left-handed", Boolean(prefs.leftHanded));
  document.documentElement.style.setProperty(
    "--touch-scale",
    String(prefs.scale || 1),
  );
}
el("volume").value = (ui.prefs.volume ?? 0.45) * 100;
el("quality").value = ui.prefs.quality || "auto";
el("motion").checked =
  ui.prefs.motion ?? matchMedia("(prefers-reduced-motion: reduce)").matches;
el("left-handed").checked = Boolean(ui.prefs.leftHanded);
el("touch-scale").value = (ui.prefs.scale || 1) * 100;
applySettings(ui.prefs);
el("sound").onclick = () => {
  audio.muted = !audio.muted;
  audio.level(audio.volume, audio.muted);
  el("sound").textContent = audio.muted ? "×♫" : "♫";
  if (!audio.muted)
    audio.start().catch((error) => {
      el("sound").title = String(error);
    });
};
window.addEventListener("keydown", (event) => {
  if (event.code === "Escape" && !document.querySelector("dialog[open]"))
    pause();
  if (event.code === "KeyP") pause();
});
window.addEventListener("blur", pause);
el("game").addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  pause();
  el("fatal").hidden = false;
  el("fatal").textContent = ui.t(
    "Đang khôi phục hình ảnh. Cuốc xe đã được tạm dừng.",
    "Restoring graphics. Your run is paused.",
  );
});
el("game").addEventListener("webglcontextrestored", () => {
  el("fatal").hidden = true;
  if (view) view.renderer.shadowMap.needsUpdate = true;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
el("debug").hidden = !params.has("debug");
if (params.has("debug"))
  Object.defineProperty(window, "xeom", {
    value: {
      get run() {
        return run;
      },
      get view() {
        return view;
      },
      get input() {
        return input;
      },
      get state() {
        return { playing, paused };
      },
    },
  });

function frame(now) {
  const measuredElapsed = (now - previous) / 1000;
  const elapsed = Math.min(measuredElapsed, 0.25);
  previous = now;
  if (playing && !paused && !run.ended) {
    accumulator += elapsed;
    while (accumulator >= CONFIG.step) {
      run.step(input.state);
      input.consume();
      accumulator -= CONFIG.step;
    }
    while (run.events.length) {
      const event = run.events.shift();
      ui.event(event, run.time);
      audio.event(event.type);
    }
    if (run.ended) {
      input.reset();
      ui.finish(run);
    }
  } else if (!playing) {
    menuTime += elapsed;
    for (const vehicle of run.traffic) {
      vehicle.active = vehicle.id < CONFIG.trafficCount;
      trafficPose(vehicle, menuTime);
    }
  }
  if (view) {
    view.update(run, elapsed, playing, measuredElapsed);
    ui.update(run, view, now / 1000);
  }
  audio.update(run, playing && !paused && !run.ended);
  requestAnimationFrame(frame);
}
if (view) requestAnimationFrame(frame);
