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
    if (result.alleys >= 3) return "YOU KNOW THE ALLEYS";
    if (result.nearMisses >= 12) return "THAT WAS TIGHT";
    if (result.horns >= 20) return "EASY ON THE HORN";
    if (result.crashes >= 5) return "BIKE'S SEEN BETTER DAYS";
    return "SOLID SAIGON RUN";
  }
  if (result.alleys >= 3) return "BÁC TÀI RÀNH HẺM";
  if (result.nearMisses >= 12) return "BÁC TÀI LÁCH KHÉO";
  if (result.horns >= 20) return "BÁC TÀI BÓP CÒI HƠI NHIỀU";
  if (result.crashes >= 5) return "BÁC TÀI HÔM NAY HƠI XUI";
  return "CA NÀY BÁC TÀI CHẠY ỔN";
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
  c.fillText(
    en ? "SAIGON · TODAY'S RUN" : "SÀI GÒN · CA CHẠY APP HÔM NAY",
    73,
    162,
  );
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
    en
      ? "SHIFT'S OVER. HERE'S HOW IT WENT."
      : "CA HÔM NAY ĐÃ HẾT. BÁC TÀI COI LẠI MÌNH VỪA CHẠY RA SAO.",
    73,
    282,
    930,
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
        ["BEST RHYTHM", "×" + result.bestCombo],
        ["CLOSE PASSES", String(result.nearMisses)],
        ["RIDES DONE", String(result.deliveries)],
        ["DISTANCE", Math.round(result.distance) + " m"],
        ["CRASHES", String(result.crashes)],
      ]
    : [
        ["TIỀN CUỐC", result.money.toLocaleString("vi-VN") + " ₫"],
        ["NHỊP TỐT NHẤT", "×" + result.bestCombo],
        ["LÁCH XE", String(result.nearMisses)],
        ["CUỐC ĐÃ CHỐT", String(result.deliveries)],
        ["QUÃNG ĐƯỜNG", Math.round(result.distance) + " m"],
        ["VA QUẸT", String(result.crashes)],
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
  c.fillText(
    en
      ? "YOUR TURN. FIND A BETTER WAY ↗"
      : "TỚI LƯỢT BÁC TÀI. THỬ CHẠY CUỐC NÀY ↗",
    106,
    1163,
    860,
  );
  c.fillStyle = "#f5edda";
  c.font = "22px monospace";
  c.fillText(result.seed + " UTC · " + CONFIG.version, 74, 1254);
  c.font = "18px Arial";
  c.fillStyle = "#acc3b5";
  c.fillText(
    en
      ? "SAME SAIGON. DIFFERENT ROUTE."
      : "Cùng một cuốc, cùng điểm đón và điểm trả. Mỗi bác tài chọn một đường.",
    74,
    1293,
    930,
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
          "Ảnh kết quả đã được lưu.",
          "Image saved.",
        );
      } else
        el("share-status").textContent = ui.t(
          "Máy chưa tạo được ảnh. Bác tài thử lại một lần nữa nha.",
          "Couldn't make the image. Give it another try.",
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
      "Dữ liệu của ca chạy này đã được lưu.",
      "Run saved.",
    );
  };
  el("share").onclick = async () => {
    const run = getRun(),
      url = challengeUrl(run.seed),
      text = ui.t(
        `Tôi vừa chạy xong một ca Xe Ôm Chaos: ${run.stats.score} điểm, nhịp ×${run.stats.bestCombo}.\nCùng điểm đón, cùng điểm trả. Thử coi bạn chạy cuốc này có ngon hơn không.`,
        `Just finished a Xe Ôm Chaos run: ${run.stats.score} points, rhythm ×${run.stats.bestCombo}.\nSame Saigon, same traffic. See if you can find a better way through.`,
      );
    if (navigator.share) {
      try {
        await navigator.share({ title: "Xe Ôm Chaos: Saigon", text, url });
        el("share-status").textContent = ui.t(
          "Bảng chia sẻ đã được mở.",
          "Share sheet's open.",
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
        "Lời thách và liên kết đã được sao chép.",
        "Copied. Send it to somebody brave.",
      );
    } catch {
      el("share-status").textContent = text + "\n" + url;
    }
  };
}
