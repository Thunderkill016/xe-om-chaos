import { readFile, writeFile } from "node:fs/promises";

async function replaceExact(path, replacements) {
  let text = await readFile(path, "utf8");
  for (const [from, to] of replacements) {
    if (!text.includes(from)) throw new Error(`Missing expected copy in ${path}: ${from}`);
    text = text.replace(from, to);
  }
  await writeFile(path, text);
}

await replaceExact("index.html", [
  [
    "Chạy một cuốc xe ôm giữa Sài Gòn: app nổ cuốc, tài xế tới điểm đón, né giờ tan tầm và đưa khách tới đúng điểm trả.",
    "Ba phút chạy cuốc giữa Sài Gòn: nhận cuốc, tới điểm đón, len qua giờ tan tầm và đưa khách tới đúng điểm trả.",
  ],
  [
    "App vừa nổ cuốc đầu tiên. Khách đang\n          đứng chờ ở điểm đón.",
    "App vừa phát cuốc mới. Điểm đón: Cà phê Mây Nhỏ.",
  ],
  [
    "Chạy app ở Sài Gòn, tài xế nào cũng gặp cảnh này:<br />đường lớn kẹt\n          thì canh hẻm thông mà luồn. Đón đúng người, trả đúng điểm, chốt cuốc\n          rồi mới tính cuốc kế.",
    "Ba phút chạy cuốc giữa Sài Gòn.<br />Đường lớn kẹt thì kiếm hẻm thông;\n          đón khách, trả khách, chốt cuốc rồi chạy tiếp.",
  ],
  ["NỔ MÁY, ĐI THÔI ↗", "NHẬN CUỐC ↗"],
  [
    "Một ca 3 phút · app sẽ nổ nhiều cuốc liên tiếp",
    "Cuốc đầu: Cà phê Mây Nhỏ → Hẻm 26 · ca 3 phút",
  ],
  [
    "CÓ BỮA TÀI XẾ ĐỨNG ĐIỂM<br />CẢ CHỤC PHÚT VẪN CHƯA NỔ CUỐC.",
    "CÓ BỮA ĐỨNG ĐIỂM CẢ CHỤC PHÚT<br />VẪN CHƯA NỔ CUỐC.",
  ],
  [
    "CÓ BỮA VỪA CHỐT CUỐC NÀY, APP ĐÃ RÉO CUỐC KẾ.",
    "CÓ BỮA VỪA TRẢ KHÁCH XONG, CUỐC KẾ ĐÃ NỔ.",
  ],
  ["CHỈNH XE CHÚT", "CÀI ĐẶT"],
  ["TÀI XẾ ĐANG TẠM NGHỈ", "CUỐC ĐANG TẠM DỪNG"],
  [
    "Ca hôm nay hết rồi. Coi lại mấy cuốc vừa chạy trước khi tắt app.",
    "Hết ca rồi. Coi lại mấy cuốc vừa chạy trước khi tắt app.",
  ],
  ["CHẠY THÊM CUỐC NỮA ↗", "CHẠY LẠI CA NÀY ↗"],
  ["Gửi cuốc này cho bạn", "Thách bạn chạy ca này"],
  [
    "Ca này nghỉ tay. Mai mở app rồi kiếm cuốc tiếp.",
    "Hết ca rồi. Mai mở app chạy tiếp.",
  ],
]);

await replaceExact("src/platform/UI.js", [
  [
    '"Khách đang trễ giờ. Cuốc này được thêm tiền nếu bác tài trả khách sớm."',
    '"Khách dặn: “Anh ráng giúp em tới sớm chút nha, em sắp vô họp rồi.”"',
  ],
  [
    '"Cô Tư không vội. Cuốc này được thêm tiền nếu bác tài chạy êm."',
    '"Cô Tư dặn: “Con cứ chạy êm êm giùm cô, cô không gấp đâu.”"',
  ],
  [
    '"Bạn sinh viên rành khu này. Cuốc này được thêm tiền nếu bác tài đi xuyên hẻm."',
    '"Khách dặn: “Anh thấy hẻm nào thông thì quẹo vô nha, em rành khu này.”"',
  ],
  [
    '"Khách này thích cảm giác mạnh. Cuốc này được thêm tiền nếu bác tài lách sát mà không va quẹt."',
    '"Khách dặn: “Anh lách gọn thì em khoái, miễn đừng quẹt xe người ta.”"',
  ],
  [
    '"Cuốc vừa nổ. Bác tài đang chạy tới điểm đón; đường lớn kẹt thì canh hẻm thông mà né."',
    '"App đã nhận cuốc. Điểm đón ở phía trước; đường lớn kẹt thì kiếm hẻm thông mà đi."',
  ],
  [
    '"Khách đã lên xe. Bác tài đang chạy tới điểm trả; đường lớn kẹt thì canh hẻm thông mà né."',
    '"Khách đã lên xe. Điểm trả ở phía trước; đường lớn kẹt thì kiếm hẻm thông mà đi."',
  ],
  [
    '"Xe vừa va quẹt. Bác tài dựng xe thẳng lại rồi hãy lên ga tiếp."',
    '"Xe vừa va quẹt. Dựng xe thẳng lại rồi mới lên ga tiếp."',
  ],
  [
    '"Bác tài đứng yên một chút để khách lên xe cho chắc."',
    '"Xe đã dừng đúng điểm đón. Chờ một chút để khách lên xe."',
  ],
  [
    '"Bác tài đứng yên một chút để khách xuống xe cho hẳn."',
    '"Xe đã dừng đúng điểm trả. Chờ một chút để khách xuống xe."',
  ],
  [
    '"Bác tài sắp tới điểm đón. Rà thắng và dừng gọn trong vòng vàng."',
    '"Điểm đón ở ngay phía trước. Rà thắng rồi dừng gọn trong vòng vàng."',
  ],
  [
    '"Bác tài sắp tới điểm trả. Rà thắng và dừng gọn trong vòng xanh."',
    '"Điểm trả ở ngay phía trước. Rà thắng rồi dừng gọn trong vòng xanh."',
  ],
  [
    '"Bác tài giữ ga ↑ để xe chạy; bấm ←/→ để quẹo."',
    '"Xe đang đứng yên. Giữ ga ↑ để chạy; bấm ←/→ để quẹo."',
  ],
  [
    '"Bác tài giữ W / ↑ để lên ga; dùng A/D để quẹo và S để thắng."',
    '"Xe đang đứng yên. Giữ W / ↑ để lên ga; dùng A/D để quẹo và S để thắng."',
  ],
  [
    '"Cuốc này trễ giờ rồi, nhưng bác tài vẫn phải trả khách đúng điểm."',
    '"Cuốc đã quá giờ. Khách vẫn cần được đưa tới đúng điểm trả."',
  ],
  ['text("Bác tài đang chạy tới điểm đón", "Pick up passenger")', 'text("Đang tới điểm đón", "Pick up passenger")'],
  ['text("Bác tài đang đưa khách tới điểm trả", "Take passenger there")', 'text("Đang chở khách tới điểm trả", "Take passenger there")'],
  [
    '"Ca chạy app hôm nay · " + seed',
    '"Ca hôm nay · " + seed',
  ],
  [
    'this.t("Hôm nay bác tài đang có kỷ lục: ", "Today\'s best: ")',
    'this.t("Kỷ lục ca hôm nay trên máy này: ", "Today\'s best: ")',
  ],
  [
    '"Bác tài không cần đăng nhập. App nổ cuốc là chạy."',
    '"Chưa có kỷ lục trên máy này. Nhận cuốc rồi chạy thôi."',
  ],
  [
    'if (passenger) text = this.t(passenger.line, passenger.subtitle);',
    'if (passenger)\n      text = this.t("Khách: " + passenger.line, "Passenger: " + passenger.subtitle);',
  ],
  [
    'event.text.toLowerCase().includes("trễ")\n          ? "Khách đã tới điểm trả, nhưng cuốc này bị trễ giờ."\n          : "Khách đã tới điểm trả. Cuốc này chốt xong."',
    'event.text.toLowerCase().includes("trễ")\n          ? "Đã tới điểm trả. Cuốc này bị trễ giờ."\n          : "Đã tới điểm trả. Cuốc này hoàn thành."',
  ],
  [
    '"Khách phía sau giật mình: “Anh ơi, coi chừng!”"',
    '"Khách: “Anh ơi, coi chừng!”"',
  ],
  [
    '"Bác tài vừa phát hiện Hẻm 26 thông ra đường bên kia."',
    '"Hẻm 26 thông ra đường bên kia. Nhớ đường này, lúc kẹt xe có thể cứu cả cuốc."',
  ],
  [
    '"Bác tài vừa lách lọt hai xe. Cuốc này đang chạy khá ngọt."',
    '"Pha lách vừa rồi gọn. Nhịp cuốc đang lên."',
  ],
  ['this.t("Bánh trước vừa dính ổ gà.", "Pothole!")', 'this.t("Bánh trước vừa sụp ổ gà. Xe bị hụt tốc.", "Pothole!")'],
  ['this.t("Bác tài vừa lách qua một khe đẹp.", "Nice pass!")', 'this.t("Pha lách đẹp. Giữ nhịp này.", "Nice pass!")'],
  [
    '"Bác tài đi hẻm như người trong khu."',
    '"Đi hẻm gọn như người trong khu."',
  ],
  ['this.t("Khách phía sau đang ngồi khá êm.", "Smooth!")', 'this.t("Khách ngồi sau vẫn êm. Cuốc này đang đẹp.", "Smooth!")'],
  ['this.t("BÁC TÀI RÀNH HẺM", "YOU KNOW THE ALLEYS")', 'this.t("RÀNH HẺM THIỆT", "YOU KNOW THE ALLEYS")'],
  ['this.t("BÁC TÀI LÁCH KHÉO", "THAT WAS TIGHT")', 'this.t("LÁCH GỌN ĐÓ", "THAT WAS TIGHT")'],
  ['this.t("BÁC TÀI BÓP CÒI HƠI NHIỀU", "EASY ON THE HORN")', 'this.t("CÒI HƠI NHIỀU NHA", "EASY ON THE HORN")'],
  ['this.t("BÁC TÀI HÔM NAY HƠI XUI", "BIKE\'S SEEN BETTER DAYS")', 'this.t("HÔM NAY VA QUẸT HƠI NHIỀU", "BIKE\'S SEEN BETTER DAYS")'],
  ['this.t("CA NÀY BÁC TÀI CHẠY ỔN", "SOLID SAIGON RUN")', 'this.t("CA NÀY CHẠY ỔN", "SOLID SAIGON RUN")'],
  [
    '"Máy này không lưu được kỷ lục, nhưng bác tài vẫn có thể lưu ảnh kết quả."',
    '"Máy này không lưu được kỷ lục, nhưng ảnh kết quả vẫn lưu được."',
  ],
  [
    '"Bác tài vừa phá kỷ lục trên máy này ✦"',
    '"Vừa phá kỷ lục trên máy này ✦"',
  ],
  ['[this.t("LÁCH XE", "CLOSE PASSES"), result.nearMisses]', '[this.t("PHA LÁCH", "CLOSE PASSES"), result.nearMisses]'],
  ['[this.t("CUỐC XONG", "RIDES DONE"), result.deliveries]', '[this.t("CUỐC HOÀN THÀNH", "RIDES DONE"), result.deliveries]'],
  ['this.t("ĐIỂM TRÊN MÁY NÀY", "PLAYED ON THIS DEVICE")', 'this.t("KẾT QUẢ TRÊN MÁY NÀY", "PLAYED ON THIS DEVICE")'],
]);

await replaceExact("src/game/Missions.js", [
  [
    '"Anh chạy giúp em lẹ chút nha. Em sắp vô họp rồi mà giờ này đường đang kẹt quá."',
    '"Anh chạy lẹ giúp em chút nha. Em sắp vô họp rồi, mà giờ này đường lại kẹt."',
  ],
  [
    '"Cô không có gấp đâu con. Con chạy êm êm giùm cô là được."',
    '"Cô không gấp đâu con. Con chạy êm êm giùm cô là được rồi."',
  ],
  [
    '"Em đi khu này hoài. Anh thấy hẻm nào thông thì quẹo vô, nhiều khi lẹ hơn đường lớn."',
    '"Em đi khu này hoài. Anh thấy hẻm nào thông thì quẹo vô nha, nhiều khi lẹ hơn đường lớn."',
  ],
  [
    '"Em không ngại chạy nhanh đâu. Anh lách gọn thì em khoái, chứ đừng quẹt xe người ta nha."',
    '"Em không ngại chạy nhanh đâu. Anh lách gọn thì em khoái, miễn đừng quẹt xe người ta nha."',
  ],
  [
    'this.deadline >= 0\n          ? "Khách đã tới điểm trả."\n          : "Cuốc này trễ giờ nhưng khách đã tới điểm trả."',
    'this.deadline >= 0\n          ? "Khách đã xuống xe ở điểm trả."\n          : "Cuốc bị trễ, nhưng khách đã xuống xe ở điểm trả."',
  ],
]);

await replaceExact("src/game/ChaosDirector.js", [
  [
    '"Trời Sài Gòn vừa đổ mưa. Bác tài chạy chậm lại vì mặt đường đang trơn."',
    '"Mưa Sài Gòn ập xuống rồi. Mặt đường bắt đầu trơn, chạy chậm lại chút."',
  ],
  [
    '"Giờ tan tầm bắt đầu rồi. Xe đang dồn ra đường lớn, bác tài nhớ canh khoảng trống."',
    '"Giờ tan tầm tới rồi. Xe đang dồn ra đường lớn, chừa khoảng trống mà đi."',
  ],
  [
    '"Đoạn phía trước có nhiều ổ gà. Bác tài nhả ga một chút cho đỡ dằn xe."',
    '"Đoạn đường phía trước ổ gà nhiều. Nhả ga chút cho xe đỡ dằn."',
  ],
  [
    '"Đường phía trước đang bị chặn. Bác tài có thể vòng qua hẻm bên cạnh."',
    '"Phía trước có rào chắn. Hẻm bên cạnh vẫn thông."',
  ],
  [
    '"Xe buýt đang cắt ngang ngã tư. Bác tài coi chừng đầu xe."',
    '"Xe buýt đang cắt ngang ngã tư. Coi chừng đầu xe."',
  ],
  [
    '"Đường Bến Gió đang ngập. Bác tài chạy chậm để khỏi mất lái."',
    '"Đường Bến Gió đang ngập. Nước sâu hơn bình thường, chạy chậm lại."',
  ],
]);

await replaceExact("src/platform/Share.js", [
  ['return "BÁC TÀI RÀNH HẺM";', 'return "RÀNH HẺM THIỆT";'],
  ['return "BÁC TÀI LÁCH KHÉO";', 'return "LÁCH GỌN ĐÓ";'],
  ['return "BÁC TÀI BÓP CÒI HƠI NHIỀU";', 'return "CÒI HƠI NHIỀU NHA";'],
  ['return "BÁC TÀI HÔM NAY HƠI XUI";', 'return "HÔM NAY VA QUẸT HƠI NHIỀU";'],
  ['return "CA NÀY BÁC TÀI CHẠY ỔN";', 'return "CA NÀY CHẠY ỔN";'],
  ["SÀI GÒN · CA CHẠY APP HÔM NAY", "SÀI GÒN · CA HÔM NAY"],
  [
    "CA HÔM NAY ĐÃ HẾT. BÁC TÀI COI LẠI MÌNH VỪA CHẠY RA SAO.",
    "HẾT CA RỒI. COI LẠI MÌNH VỪA CHẠY RA SAO.",
  ],
  ['["LÁCH XE", String(result.nearMisses)]', '["PHA LÁCH", String(result.nearMisses)]'],
  ['["CUỐC ĐÃ CHỐT", String(result.deliveries)]', '["CUỐC HOÀN THÀNH", String(result.deliveries)]'],
  ["TỚI LƯỢT BÁC TÀI. THỬ CHẠY CUỐC NÀY ↗", "TỚI LƯỢT BẠN. CHẠY THỬ CA NÀY ↗"],
  [
    "Cùng một cuốc, cùng điểm đón và điểm trả. Mỗi bác tài chọn một đường.",
    "Cùng một ca, cùng điểm đón và điểm trả. Khác nhau ở cách chọn đường.",
  ],
  [
    '"Máy chưa tạo được ảnh. Bác tài thử lại một lần nữa nha."',
    '"Chưa tạo được ảnh. Thử lại một lần nữa nha."',
  ],
  [
    '`Tôi vừa chạy xong một ca Xe Ôm Chaos: ${run.stats.score} điểm, nhịp ×${run.stats.bestCombo}.\\nCùng điểm đón, cùng điểm trả. Thử coi bạn chạy cuốc này có ngon hơn không.`',
    '`Tôi vừa chạy xong một ca Xe Ôm Chaos: ${run.stats.score} điểm, nhịp ×${run.stats.bestCombo}.\\nCùng điểm đón, cùng điểm trả. Thử coi bạn kiếm đường có ngon hơn không.`',
  ],
  ['"Bảng chia sẻ đã được mở."', '"Đã mở bảng chia sẻ."'],
  ['"Lời thách và liên kết đã được sao chép."', '"Đã chép lời thách và đường dẫn."'],
]);

await writeFile(
  "tests/copy-voice.test.js",
  `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport { Run } from "../src/game/Run.js";\nimport { PASSENGERS } from "../src/game/Missions.js";\nimport { CHAOS } from "../src/game/ChaosDirector.js";\nimport { getMissionGuidance } from "../src/platform/UI.js";\n\ntest("Vietnamese copy separates app voice from rider slang", async () => {\n  const html = await readFile("index.html", "utf8");\n  for (const phrase of [\n    "App vừa phát cuốc",\n    "NHẬN CUỐC",\n    "điểm đón",\n    "điểm trả",\n    "đứng điểm",\n    "nổ cuốc",\n  ])\n    assert.match(html, new RegExp(phrase, "i"));\n\n  const run = new Run("copy-voice");\n  run.stats.distance = 10;\n  const pickup = getMissionGuidance(run, "vi");\n  assert.match(pickup.phase, /Đang tới điểm đón/i);\n  assert.match(pickup.hint, /App đã nhận cuốc/i);\n  assert.doesNotMatch(pickup.phase + pickup.hint, /Bác tài/i);\n\n  run.missions.phase = "dropoff";\n  run.missions.deadline = 20;\n  const dropoff = getMissionGuidance(run, "vi");\n  assert.match(dropoff.phase, /Đang chở khách tới điểm trả/i);\n  assert.match(dropoff.hint, /Khách đã lên xe/i);\n  assert.doesNotMatch(dropoff.phase + dropoff.hint, /Bác tài/i);\n});\n\ntest("passengers keep character voice while street events describe the world", () => {\n  for (const passenger of PASSENGERS) {\n    assert.match(passenger.line, /[.!?]/);\n    assert.match(passenger.line, /(anh|em|cô|con)/i);\n  }\n\n  for (const event of CHAOS) {\n    assert.match(event.vi, /[.!?]/);\n    assert.doesNotMatch(event.vi, /Bác tài|tài xế/i);\n    assert.match(\n      event.vi,\n      /Mưa Sài Gòn|Giờ tan tầm|Đoạn đường|rào chắn|Xe buýt|Đường Bến Gió/i,\n    );\n  }\n});\n`,
);

await writeFile(
  "docs/game-dev/VIETNAMESE_INTERACTIVE_VOICE.md",
  `# Vietnamese interactive voice\n\n## Goal\n\nVietnamese should feel written inside the game, not translated into it. The player must always be able to tell who is speaking and why the line exists.\n\n## Four voices\n\n1. **Driver app** — operational and clear. Use real ride-hailing terms: phát cuốc, nhận cuốc, điểm đón, điểm trả, cuốc hoàn thành. The app does not call the player “bác tài” every sentence.\n2. **Passenger** — character-first dialogue. Each passenger owns a relationship and pronoun set (anh/em, cô/con), a reason for the trip, and a speaking rhythm.\n3. **Saigon street** — world events describe what is actually happening: mưa, tan tầm, xe buýt, ổ gà, ngập, rào chắn. Do not turn the world into an announcer addressing “bác tài”.\n4. **Game/result voice** — short, playful feedback. It may be colloquial, but never forced dialect. “Rành hẻm thiệt” is acceptable; stuffing every line with southern slang is not.\n\n## Interaction rules\n\n- Functional labels can be fragments: TIỀN CUỐC, ĐIỂM ĐÓN, CÀI ĐẶT.\n- Spoken/event copy should have an identifiable subject or a natural Vietnamese imperative.\n- Do not repeat information across mission phase, hint and passenger preference.\n- Put profession slang where a rider would actually use it. “Nổ cuốc” and “đứng điểm” belong to rider culture; formal app/system copy prefers “phát cuốc” and “nhận cuốc”.\n- The Vietnamese edition is authored independently. Do not mirror English sentence structure.\n- Test in context. A grammatically correct line still fails if it sounds like a notification template or if the player cannot tell who said it.\n\n## Studio-derived principles\n\n- Nintendo localization interviews for Hotel Dusk: make dialogue sound like real people, with a distinct style for each character rather than stage-like speech.\n- Ubisoft narrative design: narrative delivery spans gameplay systems, NPC barks and UI text; presentation must be readable and immersive in context. Ubisoft La Forge also notes that fluent generated dialogue becomes generic when character style and speech patterns are missing.\n- Riot Games localization: localization is not word substitution; regional experts should make content culturally resonant and should be involved early.\n- Blizzard localization: preserve the emotional effect rather than translating blindly; cultural references and speech patterns can be reinterpreted for the target audience.\n- Sony Interactive Entertainment localization workflow: localization quality is built earlier in production and then validated in context rather than treated as a final translation pass.\n\n## References\n\n- https://www.nintendo.com/en-gb/News/2007/Localising-Hotel-Dusk-pt-2-249771.html\n- https://news.ubisoft.com/en-us/article/7m412GLSbfkaT0YheRYLVG/what-is-narrative-design\n- https://www.ubisoft.com/en-us/studio/laforge/news/7CCHPeIseXSW1P49L4XZ7l/generating-video-game-scripts-with-style\n- https://www.riotgames.com/vi/news/kat-riot-lgbtq-localization-vi\n- https://worldofwarcraft.blizzard.com/en-gb/news/10071211\n- https://gdcvault.com/play/1024064/Steps-for-Effective\n- https://www.grab.com/vn/blog/driver/grabtaxi-tom-tat-quy-trinh-nhan-cuoc-xe/\n- https://www.grab.com/vn/blog/driver/grabbike-thuongdonxa/\n`,
);

console.log("Vietnamese interactive voice pass applied.");
