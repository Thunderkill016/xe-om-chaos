#!/usr/bin/env node
/**
 * Xe Om Chaos — AI Dev Assistant (Powered by gpt-6-astra via Experiential Gateway)
 * Your AI Pair Programmer to develop, debug, and expand the game.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { execSync } from "node:child_process";
import { createLLMClient, EXPERIENTIAL_CONFIG } from "../src/platform/LLM.js";

// ANSI Color Helpers
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  bgBlue: "\x1b[44m\x1b[37m",
};

// 1. Load .env
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (key && val && !process.env[key]) process.env[key] = val;
    }
  }
}

// 2. Validate API key
const apiKey = process.env[EXPERIENTIAL_CONFIG.envKeyName];
if (!apiKey || apiKey.trim() === "") {
  console.error(`${C.red}❌ LỖI: Chưa có API key trong file .env!${C.reset}`);
  console.error(
    `Vui lòng mở file ${C.bold}/home/thunder/Code/xe-om-chaos/.env${C.reset} và dán key vào:`,
  );
  console.error(`  ${C.cyan}EXPLABS_API_KEY=your_api_key_here${C.reset}\n`);
  process.exit(1);
}

// 3. Collect project context for the AI
function getProjectSummary() {
  let designDoc = "";
  if (existsSync("GAME_DESIGN.md")) {
    designDoc = readFileSync("GAME_DESIGN.md", "utf8").slice(0, 3500);
  }

  return `
DỰ ÁN: Xe Ôm Chaos Saigon (Three.js WebGL Driving Game)
- Công nghệ: Pure ES modules, Three.js 0.180.0, Native WebGL, 60fps fixed-tick simulation.
- Thiết kế: Chạy xe ôm đón/trả khách tại Sài Gòn trong 180 giây. Kẹt xe, ngập nước, trời mưa, né ổ gà, lách hẻm (shortcuts).
- Cấu trúc thư mục chính:
  * src/main.js: Vòng lặp game và state machine.
  * src/game/Run.js: Vật lý xe máy, va chạm, tính điểm.
  * src/game/ChaosDirector.js: Sự kiện ngẫu nhiên (mưa ngập, xe buýt, rào chắn, ổ gà).
  * src/game/Missions.js: Đón khách, tính tiền cước, bonus luồn lách.
  * src/game/config.js: Hằng số vật lý (tốc độ, gia tốc, bán kính va chạm, thời gian chơi 180s).
  * src/world/map.js: Bản đồ Sài Gòn, đại lộ, hẻm luồn lách, tọa độ ranh giới.
  * src/view/City.js & Characters.js: Render 3D, ánh sáng, mô hình xe và nhân vật.
  * src/platform/: Input (bàn phím/touch), Audio (âm thanh bíp còi), UI, Share.
  * scripts/: serve.mjs, smoke.mjs, test-llm.mjs, ai-dev.mjs.
  * tests/: Bộ test tự động (20 tests kiểm thử physics, deterministic seed, scoring).

QUY CHUẨN CODE:
1. Viết code JavaScript/ES modules sạch, không dùng bundler (chạy native trên browser).
2. Khi đề xuất thay đổi, nêu rõ: Tên file, đoạn code cần sửa, và giải thích ngắn gọn bằng tiếng Việt.
3. Giữ vững tính tất định (deterministic physics) và đảm bảo chạy pass lệnh 'npm run quality' (tsc, tests, prettier).
`.trim();
}

const systemPrompt = `
Bạn là Kỹ sư Trưởng kiêm Senior Game Developer phụ trách phát triển game "Xe Ôm Chaos Saigon".
Dưới đây là tổng quan kiến trúc dự án:
${getProjectSummary()}

Nhiệm vụ của bạn:
- Hỗ trợ lập trình viên viết code mới, tối ưu hóa vật lý, thêm cơ chế gameplay mới (ví dụ: xe cứu thương, chợ bến thành, cảnh sát giao thông, âm thanh, hiệu ứng đồ họa Three.js).
- Viết code hoàn chỉnh, chính xác, có thể copy dán thẳng vào dự án.
- Trao đổi bằng tiếng Việt tự nhiên, chuyên nghiệp và nhiệt tình.
`.trim();

const client = createLLMClient();
const conversationHistory = [{ role: "system", content: systemPrompt }];

/**
 * Streams chat completion to process.stdout
 */
async function askModel(userMessage) {
  conversationHistory.push({ role: "user", content: userMessage });

  process.stdout.write(`\n${C.green}${C.bold}🤖 gpt-6-astra:${C.reset}\n`);

  try {
    const res = await client.chatCompletion({
      messages: conversationHistory,
      stream: true,
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullReply = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":") || trimmed === "data: [DONE]")
          continue;
        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content || "";
            if (delta) {
              fullReply += delta;
              process.stdout.write(delta);
            }
          } catch {}
        }
      }
    }

    process.stdout.write("\n\n");
    conversationHistory.push({ role: "assistant", content: fullReply });
  } catch (err) {
    console.error(
      `\n${C.red}❌ Lỗi gọi model: ${err?.message || err}${C.reset}\n`,
    );
  }
}

// 4. Command Line Handling
const directArgs = process.argv.slice(2).join(" ").trim();

if (directArgs) {
  // One-shot mode
  console.log(
    `${C.cyan}${C.bold}🏍️  XE ÔM CHAOS — AI DEV ASSISTANT (${EXPERIENTIAL_CONFIG.model})${C.reset}`,
  );
  console.log(`${C.dim}Yêu cầu: "${directArgs}"${C.reset}`);
  await askModel(directArgs);
  process.exit(0);
}

// 5. Interactive REPL Mode
console.clear();
console.log(
  `${C.bgBlue} 🏍️  XE ÔM CHAOS — AI DEV ASSISTANT (gpt-6-astra via Experiential) ${C.reset}`,
);
console.log(
  `${C.dim}Trợ lý lập trình viên AI sẵn sàng hỗ trợ code game.${C.reset}`,
);
console.log(`- Nhập yêu cầu code, tính năng, hoặc sửa lỗi bằng tiếng Việt.`);
console.log(
  `- Lệnh nhanh: ${C.yellow}/files${C.reset} (xem file), ${C.yellow}/read <file>${C.reset} (đọc code file), ${C.yellow}/test${C.reset} (chạy test), ${C.yellow}/exit${C.reset} (thoát).\n`,
);

const rl = readline.createInterface({ input, output });

while (true) {
  try {
    const query = await rl.question(`${C.cyan}${C.bold}xe-om-dev> ${C.reset}`);
    const trimmed = query.trim();

    if (!trimmed) continue;
    if (trimmed === "/exit" || trimmed === "exit" || trimmed === "quit") {
      console.log(
        `${C.dim}Tạm biệt bác tài! Hẹn gặp lại trên đại lộ Sài Gòn.${C.reset}`,
      );
      rl.close();
      process.exit(0);
    }

    if (trimmed === "/files") {
      console.log(
        `\n${C.yellow}📂 Danh sách source code chính trong src/:${C.reset}`,
      );
      function walk(dir) {
        for (const item of readdirSync(dir)) {
          const p = join(dir, item);
          if (statSync(p).isDirectory()) walk(p);
          else if (p.endsWith(".js")) console.log(`  - ${p}`);
        }
      }
      walk("src");
      console.log();
      continue;
    }

    if (trimmed.startsWith("/read ")) {
      const filePath = trimmed.slice(6).trim();
      if (existsSync(filePath)) {
        const fileContent = readFileSync(filePath, "utf8");
        console.log(
          `${C.green}Đã nạp nội dung file ${filePath} (${fileContent.length} bytes) vào ngữ cảnh!${C.reset}`,
        );
        await askModel(
          `Dưới đây là nội dung file \`${filePath}\`:\n\`\`\`javascript\n${fileContent}\n\`\`\`\nHãy kiểm tra và cho ý kiến.`,
        );
      } else {
        console.log(`${C.red}File không tồn tại: ${filePath}${C.reset}`);
      }
      continue;
    }

    if (trimmed === "/test") {
      console.log(
        `\n${C.yellow}🧪 Đang chạy bộ kiểm thử 'npm test'...${C.reset}`,
      );
      try {
        const testOut = execSync("npm test", { encoding: "utf8" });
        console.log(testOut);
        await askModel(
          `Tôi vừa chạy 'npm test' và kết quả như sau:\n\`\`\`\n${testOut.slice(0, 1000)}\n\`\`\`\nHãy xác nhận tình trạng dự án.`,
        );
      } catch (err) {
        console.error(
          `${C.red}Test thất bại:${C.reset}\n`,
          err.stdout || err.message,
        );
        await askModel(
          `Lệnh test bị lỗi như sau:\n\`\`\`\n${(err.stdout || err.message).slice(0, 1500)}\n\`\`\`\nHãy hướng dẫn sửa.`,
        );
      }
      continue;
    }

    // Normal AI Prompt
    await askModel(trimmed);
  } catch (err) {
    console.error(`${C.red}Lỗi tương tác:${C.reset}`, err?.message || err);
  }
}
