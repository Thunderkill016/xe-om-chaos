#!/usr/bin/env node
/**
 * Xe Om Chaos — Autonomous Codex Coding Agent
 * Powered by gpt-6-astra via Experiential Gateway (reasoning_effort: xhigh)
 *
 * Works autonomously like OpenAI Codex / Claude Code / Cursor Agent:
 * Takes an instruction, reads code, edits files, runs tests, self-corrects, and finishes.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "node:fs";
import { resolve, join, relative } from "node:path";
import { execSync } from "node:child_process";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createLLMClient, EXPERIENTIAL_CONFIG } from "../src/platform/LLM.js";

// ANSI Styling
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  bgCyan: "\x1b[46m\x1b[30m",
  bgMagenta: "\x1b[45m\x1b[37m",
};

// 1. Auto-load .env
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
  console.error(
    `\n${C.red}❌ LỖI: Chưa có EXPLABS_API_KEY trong file .env!${C.reset}`,
  );
  console.error(`Vui lòng mở file ${C.bold}.env${C.reset} và dán key vào:`);
  console.error(`  ${C.cyan}EXPLABS_API_KEY=your_key_here${C.reset}\n`);
  process.exit(1);
}

// 3. Define Codex Agent Tools
const TOOLS = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Đọc toàn bộ nội dung của một file trong dự án.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Đường dẫn tương đối đến file, ví dụ: 'src/game/Run.js'",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Ghi đè toàn bộ nội dung hoặc tạo mới một file.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Đường dẫn file cần tạo hoặc ghi đè",
          },
          content: { type: "string", description: "Nội dung đầy đủ của file" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description:
        "Sửa file bằng cách thay thế một đoạn chuỗi chính xác (old_string -> new_string).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Đường dẫn file cần sửa" },
          old_string: {
            type: "string",
            description:
              "Đoạn code cũ cần thay thế (phải khớp chính xác từng ký tự và thụt dòng)",
          },
          new_string: {
            type: "string",
            description: "Đoạn code mới thay thế vào",
          },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description:
        "Liệt kê danh sách tất cả các file mã nguồn trong một thư mục.",
      parameters: {
        type: "object",
        properties: {
          directory: {
            type: "string",
            description: "Thư mục cần xem, mặc định là 'src'",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Thực thi lệnh shell (ví dụ: 'npm test', 'npm run typecheck') để tự kiểm tra lỗi sau khi sửa code.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Lệnh cần chạy trong terminal",
          },
        },
        required: ["command"],
      },
    },
  },
];

// 4. Tool Execution Handlers
function executeTool(name, args) {
  try {
    if (name === "read_file") {
      const p = resolve(process.cwd(), args.path);
      if (!existsSync(p)) return `ERROR: File không tồn tại tại '${args.path}'`;
      const content = readFileSync(p, "utf8");
      return content;
    }

    if (name === "write_file") {
      const p = resolve(process.cwd(), args.path);
      writeFileSync(p, args.content, "utf8");
      return `SUCCESS: Đã ghi thành công file '${args.path}' (${args.content.length} bytes).`;
    }

    if (name === "edit_file") {
      const p = resolve(process.cwd(), args.path);
      if (!existsSync(p)) return `ERROR: File không tồn tại tại '${args.path}'`;
      const content = readFileSync(p, "utf8");
      if (!content.includes(args.old_string)) {
        return `ERROR: Không tìm thấy 'old_string' trong file '${args.path}'. Hãy đọc lại file bằng read_file để lấy chuỗi chính xác.`;
      }
      const updated = content.replace(args.old_string, args.new_string);
      writeFileSync(p, updated, "utf8");
      return `SUCCESS: Đã thay thế code thành công trong file '${args.path}'.`;
    }

    if (name === "list_files") {
      const targetDir = args.directory || "src";
      const files = [];
      function walk(dir) {
        if (!existsSync(dir)) return;
        for (const item of readdirSync(dir)) {
          const p = join(dir, item);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(process.cwd(), p));
        }
      }
      walk(targetDir);
      return `Các file trong ${targetDir}:\n` + files.join("\n");
    }

    if (name === "run_command") {
      // Basic safety: block dangerous rm -rf or system drops
      if (
        args.command.includes("rm -rf /") ||
        args.command.includes(":(){ :|:& };:")
      ) {
        return "ERROR: Lệnh bị chặn vì lý do an toàn.";
      }
      try {
        const out = execSync(args.command, {
          encoding: "utf8",
          timeout: 25000,
        });
        return out.slice(0, 3000);
      } catch (cmdErr) {
        return `COMMAND FAILED (Code ${cmdErr.status}):\n${(cmdErr.stdout || "") + (cmdErr.stderr || cmdErr.message)}`.slice(
          0,
          3000,
        );
      }
    }

    return `ERROR: Công cụ '${name}' không tồn tại.`;
  } catch (err) {
    return `ERROR khi thực thi ${name}: ${err?.message || err}`;
  }
}

// 5. System Prompt defining Autonomous Codex Agent Persona
const SYSTEM_PROMPT = `
Bạn là một Autonomous Software Engineer (Codex Agent) chuyên nghiệp phụ trách phát triển và bảo trì game "Xe Ôm Chaos Saigon".
Game sử dụng Three.js (WebGL), Native ES Modules (không bundler), mô phỏng vật lý 60fps tất định (deterministic).

QUY TRÌNH LÀM VIỆC TỰ CHỦ CỦA BẠN (AUTONOMOUS LOOP):
1. Khi người dùng giao nhiệm vụ (ví dụ: sửa lỗi, thêm loại xe mới, chỉnh tốc độ, thêm hiệu ứng):
   - ĐẦU TIÊN: Dùng 'read_file' hoặc 'list_files' để kiểm tra mã nguồn thực tế trước khi sửa. KHÔNG ĐOÁN mò code.
   - TIẾP THEO: Dùng 'edit_file' (hoặc 'write_file') để sửa trực tiếp vào file mã nguồn trên đĩa.
   - SAU ĐÓ: Dùng 'run_command' chạy 'npm run typecheck' và 'npm test' để xác minh code bạn vừa sửa không làm hỏng game.
   - NẾU CÓ LỖI: Tự động đọc thông báo lỗi, sửa lại code cho đến khi toàn bộ test PASS 100%.
   - KHI HOÀN THÀNH: Trả lời người dùng bằng tiếng Việt, giải thích tóm tắt các file đã sửa và kết quả kiểm thử.

Các file quan trọng trong dự án:
- src/main.js: Vòng lặp game và state machine.
- src/game/Run.js: Vật lý xe máy, va chạm, tính điểm.
- src/game/ChaosDirector.js: Sự kiện ngẫu nhiên (mưa, ngập, xe buýt, ổ gà).
- src/game/Missions.js: Đón khách, tính tiền cước, bonus luồn lách.
- src/game/config.js: Hằng số vật lý (tốc độ, gia tốc, bán kính va chạm, thời gian 180s).
- src/world/map.js: Bản đồ Sài Gòn, đại lộ, hẻm luồn lách.
- src/view/City.js & Characters.js: Render 3D Three.js.
`.trim();

// 6. Autonomous Execution Engine
const client = createLLMClient();

async function runAutonomousTask(userInstruction) {
  console.log(
    `\n${C.bgCyan} 🤖 CODEX AGENT KHỞI ĐỘNG ${C.reset} ${C.dim}(gpt-6-astra xhigh reasoning)${C.reset}`,
  );
  console.log(`${C.bold}Nhiệm vụ:${C.reset} ${userInstruction}\n`);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userInstruction },
  ];

  const maxSteps = 15;
  let step = 0;

  while (step < maxSteps) {
    step++;
    console.log(
      `${C.dim}--- Bước suy luận & hành động ${step}/${maxSteps} ---${C.reset}`,
    );

    let response;
    try {
      response = await client.chatCompletion({
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        reasoning_effort: "xhigh",
      });
    } catch (apiErr) {
      console.error(
        `${C.red}❌ Lỗi kết nối Experiential Gateway:${C.reset}`,
        apiErr?.message || apiErr,
      );
      return;
    }

    const choice = response.choices?.[0];
    const message = choice?.message;
    if (!message) {
      console.error(`${C.red}Phản hồi rỗng từ mô hình.${C.reset}`);
      break;
    }

    messages.push(message);

    // If model has thoughts/text, display it
    if (message.content && message.content.trim()) {
      console.log(
        `\n${C.green}${C.bold}💬 Codex Agent:${C.reset}\n${message.content}\n`,
      );
    }

    // Check if model called tools
    const toolCalls = message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      console.log(
        `${C.cyan}🏁 Codex Agent đã hoàn thành nhiệm vụ!${C.reset}\n`,
      );
      break;
    }

    // Execute each tool call
    for (const call of toolCalls) {
      const toolName = call.function.name;
      let toolArgs = {};
      try {
        toolArgs = JSON.parse(call.function.arguments);
      } catch {
        toolArgs = { raw: call.function.arguments };
      }

      console.log(
        `${C.yellow}⚡ [Thực thi Tool]${C.reset} ${C.bold}${toolName}${C.reset}(${C.dim}${JSON.stringify(toolArgs).slice(0, 120)}${C.reset})`,
      );

      const toolResult = executeTool(toolName, toolArgs);

      const preview =
        typeof toolResult === "string"
          ? toolResult.slice(0, 180)
          : JSON.stringify(toolResult);
      console.log(
        `  ${C.magenta}↳ Kết quả:${C.reset} ${C.dim}${preview}${preview.length >= 180 ? "..." : ""}${C.reset}`,
      );

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: String(toolResult),
      });
    }
  }

  if (step >= maxSteps) {
    console.log(
      `${C.yellow}⚠️ Đã đạt giới hạn tối đa ${maxSteps} bước làm việc tự chủ.${C.reset}`,
    );
  }
}

// 7. CLI Entrypoint
const cliTask = process.argv.slice(2).join(" ").trim();

if (cliTask) {
  // Direct task execution
  await runAutonomousTask(cliTask);
  process.exit(0);
}

// Interactive REPL
console.clear();
console.log(
  `${C.bgMagenta} 🤖 CODEX AUTONOMOUS AGENT — XE ÔM CHAOS SAIGON ${C.reset}`,
);
console.log(
  `${C.dim}Nhập lệnh / nhiệm vụ bằng tiếng Việt. Agent sẽ tự đọc code, tự sửa file, tự chạy test và sửa lỗi.${C.reset}`,
);
console.log(`Gõ ${C.yellow}exit${C.reset} để thoát.\n`);

const rl = readline.createInterface({ input, output });

while (true) {
  try {
    const task = await rl.question(`${C.cyan}${C.bold}codex> ${C.reset}`);
    const trimmed = task.trim();
    if (!trimmed) continue;
    if (trimmed === "exit" || trimmed === "quit") {
      console.log(
        `${C.dim}Tạm biệt! Hẹn gặp lại trên đại lộ Sài Gòn.${C.reset}`,
      );
      rl.close();
      process.exit(0);
    }
    await runAutonomousTask(trimmed);
  } catch (e) {
    console.error(`${C.red}Lỗi phiên làm việc:${C.reset}`, e?.message || e);
  }
}
