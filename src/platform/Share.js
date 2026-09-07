import { CONFIG } from "../game/config.js";
import { el } from "./UI.js";

export function challengeUrl(seed, base = location.href) {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("seed", seed);
  url.searchParams.set("v", CONFIG.version);
  return url.href;
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function cardTitle(result, language) {
  if (language === "en") {
    if (result.alleys >= 3) return "ALLEY ACE";
    if (result.nearMisses >= 12) return "TRAFFIC DANCER";
    if (result.horns >= 20) return "HORN HAPPY";
    if (result.crashes >= 5) return "STILL RIDING";
    return "SAIGON RIDER";
  }
  if (result.alleys >= 3) return "TRÙM HẺM";
  if (result.nearMisses >= 12) return "LÁCH NHƯ NƯỚC";
  if (result.horns >= 20) return "CÒI TRƯỞNG";
  if (result.crashes >= 5) return "NGÃ VẪN CHẠY";
  return "TAY LÁI SÀI GÒN";
}
export function resultCard(result, language = "vi") {
  const en = language === "en";
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const c = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  c.fillStyle = "#183536";
  c.fillRect(0, 0, 1080, 1350);
  c.fillStyle = "#284a47";
  for (let i = 0; i < 12; i++) {
    c.save();
    c.translate(600 + i * 100, -100);
    c.rotate(0.4);
    c.fillRect(0, 0, 26, 1800);
    c.restore();
  }
  c.fillStyle = "#f5edda";
  c.font = "900 68px Arial";
  c.fillText("XE ÔM CHAOS", 70, 115);
  c.fillStyle = "#ff9664";
  c.font = "bold 24px Arial";
  c.fillText(en ? "SAIGON · DAILY RUN" : "SÀI GÒN · CUỐC HÔM NAY", 73, 162);
  c.strokeStyle = "#c9d1b3";
  c.setLineDash([7, 9]);
  c.beginPath();
  c.moveTo(70, 208);
  c.lineTo(1010, 208);
  c.stroke();
  c.setLineDash([]);
  c.font = "bold 31px Arial";
  c.fillStyle = "#f5edda";
  c.fillText(
    en ? "SHIFT OVER. STORY WORTH TELLING." : "HẾT CA. CÓ CHUYỆN ĐỂ KỂ.",
    73,
    282,
  );
  c.fillStyle = "#b1efc8";
  c.font = "italic 900 66px Arial";
  c.fillText(cardTitle(result, language), 65, 387, 950);
  c.fillStyle = "#f5edda";
  c.font = "900 184px Arial";
  c.fillText(result.score.toLocaleString("en-US"), 60, 597, 960);
  c.font = "23px Arial";
  c.fillText(en ? "POINTS" : "ĐIỂM", 76, 645);
  const cells = en
    ? [
        ["FARES", result.money.toLocaleString("en-US") + " ₫"],
        ["BEST FLOW", "×" + result.bestCombo],
        ["NEAR MISSES", String(result.nearMisses)],
        ["DELIVERIES", String(result.deliveries)],
        ["DISTANCE", Math.round(result.distance) + " m"],
        ["CRASHES", String(result.crashes)],
      ]
    : [
        ["TIỀN CƯỚC", result.money.toLocaleString("vi-VN") + " ₫"],
        ["NHỊP TỐT NHẤT", "×" + result.bestCombo],
        ["LÁCH XE", String(result.nearMisses)],
        ["CUỐC ĐÃ XONG", String(result.deliveries)],
        ["QUÃNG ĐƯỜNG", Math.round(result.distance) + " m"],
        ["VA CHẠM", String(result.crashes)],
      ];
  cells.forEach(([label, value], i) => {
    const x = 76 + (i % 3) * 330,
      y = 770 + Math.floor(i / 3) * 145;
    c.fillStyle = "#acc3b5";
    c.font = "19px Arial";
    c.fillText(label, x, y);
    c.fillStyle = "#f5edda";
    c.font = "bold 43px Arial";
    c.fillText(value, x, y + 59, 300);
  });
  c.fillStyle = "#ff9664";
  c.fillRect(70, 1101, 940, 94);
  c.fillStyle = "#183536";
  c.font = "900 36px Arial";
  c.fillText(en ? "BEAT MY SAIGON RUN ↗" : "THỬ VƯỢT CUỐC NÀY ↗", 106, 1163);
  c.fillStyle = "#f5edda";
  c.font = "22px monospace";
  c.fillText(result.seed + " UTC · " + CONFIG.version, 74, 1254);
  c.font = "18px Arial";
  c.fillStyle = "#acc3b5";
  c.fillText(
    en
      ? "LOCAL SCORE · SAME CITY. YOUR ROUTE."
      : "ĐIỂM TRÊN MÁY · CÙNG THÀNH PHỐ. TỰ CHỌN ĐƯỜNG.",
    74,
    1293,
  );
  return canvas;
}
export function bindShare(getRun, ui) {
  el("save-card").onclick = () => {
    const result = getRun().result();
    resultCard(result, ui.language).toBlob((blob) => {
      if (blob) {
        download(blob, "xe-om-" + result.seed + ".png");
        el("share-status").textContent = ui.t(
          "Đã tạo ảnh kết quả.",
          "Result card ready.",
        );
      } else
        el("share-status").textContent = ui.t(
          "Chưa tạo được ảnh. Thử lại nhé.",
          "Couldn't create the image. Try again.",
        );
    }, "image/png");
  };
  el("save-replay").onclick = () => {
    const run = getRun();
    download(
      new Blob([JSON.stringify({ ...run.record, result: run.result() })], {
        type: "application/json",
      }),
      "xe-om-run-" + run.seed + ".json",
    );
    el("share-status").textContent = ui.t(
      "Đã lưu dữ liệu lượt chơi.",
      "Run data saved.",
    );
  };
  el("share").onclick = async () => {
    const run = getRun(),
      url = challengeUrl(run.seed),
      text = ui.t(
        `XE ÔM CHAOS · ${run.stats.score} điểm · NHỊP ×${run.stats.bestCombo}\nThử vượt cuốc Sài Gòn này xem!`,
        `XE ÔM CHAOS · ${run.stats.score} points · FLOW ×${run.stats.bestCombo}\nBeat my Saigon run!`,
      );
    if (navigator.share) {
      try {
        await navigator.share({ title: "Xe Ôm Chaos: Saigon", text, url });
        el("share-status").textContent = ui.t(
          "Đã mở bảng chia sẻ.",
          "Share sheet opened.",
        );
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(text + "\n" + url);
      el("share-status").textContent = ui.t(
        "Đã sao chép lời thách đấu và liên kết.",
        "Challenge and link copied.",
      );
    } catch {
      el("share-status").textContent = text + "\n" + url;
    }
  };
}
