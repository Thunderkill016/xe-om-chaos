#!/usr/bin/env node
/** Xe Om Chaos — token-efficient Astra Game Director. */
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import { join, relative, resolve, sep } from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createLLMClient, EXPERIENTIAL_CONFIG } from "../src/platform/LLM.js";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bg: "\x1b[46m\x1b[30m",
};
const ROOT = resolve(process.cwd());
const MAX_RANGE = 180;
const MAX_PATCH = 24_000;
const TEXT_EXT = new Set([
  ".js",
  ".mjs",
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".html",
  ".css",
  ".yml",
  ".yaml",
]);
const SKIP = new Set([".git", "node_modules", "output", "dist", "coverage"]);
const BUDGETS = Object.freeze({
  small: { model: 4, tools: 10, lines: 360, files: 4, output: 4_000 },
  normal: { model: 6, tools: 16, lines: 700, files: 6, output: 6_500 },
  large: { model: 8, tools: 22, lines: 1_000, files: 8, output: 9_000 },
});

function loadEnv() {
  const path = resolve(ROOT, ".env");
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    const value = line
      .slice(at + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && value && !process.env[key]) process.env[key] = value;
  }
}
loadEnv();
if (!process.env[EXPERIENTIAL_CONFIG.envKeyName]?.trim()) {
  console.error(
    `${C.red}Thiếu ${EXPERIENTIAL_CONFIG.envKeyName}. Export key hoặc thêm EXPLABS_API_KEY=xpl_... vào .env.${C.reset}`,
  );
  process.exit(1);
}

function safePath(path) {
  const full = resolve(ROOT, String(path || ""));
  if (full !== ROOT && !full.startsWith(ROOT + sep))
    throw new Error(`Path vượt project: ${path}`);
  return full;
}
function ext(path) {
  const at = path.lastIndexOf(".");
  return at < 0 ? "" : path.slice(at).toLowerCase();
}
function walk(directory = "src", limit = 600) {
  const files = [];
  function visit(dir) {
    if (!existsSync(dir) || files.length >= limit) return;
    for (const item of readdirSync(dir)) {
      if (files.length >= limit) break;
      const path = join(dir, item);
      if (statSync(path).isDirectory()) {
        if (!SKIP.has(item)) visit(path);
      } else {
        const rel = relative(ROOT, path);
        if (TEXT_EXT.has(ext(rel))) files.push(rel);
      }
    }
  }
  visit(safePath(directory));
  return files;
}
function compact(value, max = 7_000) {
  const text = String(value ?? "").trim();
  if (text.length <= max) return text;
  const head = text.slice(0, Math.floor(max * 0.6));
  const tail = text.slice(-Math.floor(max * 0.34));
  return `${head}\n… [${text.length - head.length - tail.length} chars omitted] …\n${tail}`;
}
function local(command, timeout = 60_000) {
  try {
    return {
      ok: true,
      text: execSync(command, {
        cwd: ROOT,
        encoding: "utf8",
        timeout,
        stdio: ["ignore", "pipe", "pipe"],
      }),
    };
  } catch (error) {
    return {
      ok: false,
      text: `${error.stdout || ""}${error.stderr || ""}${error.message || ""}`,
    };
  }
}
function commandResult(result) {
  const lines = String(result.text || "")
    .split("\n")
    .filter(Boolean);
  const body =
    lines.length <= 44
      ? lines
      : [
          ...lines.slice(0, 20),
          `… ${lines.length - 40} lines omitted …`,
          ...lines.slice(-20),
        ];
  return compact(`${result.ok ? "PASS" : "FAIL"}\n${body.join("\n")}`);
}
function snapshot() {
  return `HEAD: ${local("git log -1 --oneline").text.trim()}\nSTATUS:\n${compact(local("git status --short").text, 1_500) || "clean"}\nDIFF STAT:\n${compact(local("git diff --stat").text, 1_500) || "none"}`;
}
function profile(task) {
  const text = task.toLowerCase();
  if (
    [
      "architecture",
      "kiến trúc",
      "deterministic",
      "tất định",
      "systemic",
      "rewrite",
    ].some((x) => text.includes(x))
  )
    return "deep";
  if (
    [
      "physics",
      "vật lý",
      "collision",
      "va chạm",
      "traffic",
      "gameplay",
      "playcanvas",
      "three.js",
      "render",
      "đồ họa",
      "đồ hoạ",
      "visual",
      "camera",
      "performance",
      "tối ưu",
    ].some((x) => text.includes(x))
  )
    return "complex";
  if (
    ["typo", "format", "prettier", "readme", "docs", "copy"].some((x) =>
      text.includes(x),
    )
  )
    return "small";
  return "normal";
}
function budgetNameFor(taskProfile, requested) {
  if (requested && BUDGETS[requested]) return requested;
  if (taskProfile === "small") return "small";
  if (taskProfile === "deep") return "large";
  return "normal";
}
function newSession(taskProfile, budgetName) {
  return {
    profile: taskProfile,
    name: budgetName,
    budget: BUDGETS[budgetName],
    calls: 0,
    tools: 0,
    lines: 0,
    files: new Set(),
    changed: new Set(),
    state: [],
    failures: 0,
    usedXHigh: false,
    lastTools: [],
    quality: false,
    gateTried: false,
    usage: { requests: 0, input: 0, output: 0, cached: 0, total: 0 },
  };
}
function reasoning(session, step) {
  const forced = process.env.ASTRA_AGENT_REASONING?.toLowerCase();
  if (["low", "medium", "high", "xhigh", "max"].includes(forced)) return forced;
  if ((session.profile === "deep" && step === 1) || session.failures >= 2) {
    if (!session.usedXHigh) {
      session.usedXHigh = true;
      return "xhigh";
    }
  }
  if (session.profile === "small") return "medium";
  if (
    session.lastTools.length &&
    session.lastTools.every((x) => ["git_diff", "run_command"].includes(x))
  )
    return "medium";
  return "high";
}
function remember(session, text) {
  session.state.push(String(text).replace(/\s+/g, " ").trim());
  while (session.state.length > 32) session.state.shift();
}
function usage(session, response) {
  const u = response?.usage || {};
  const inputTokens = u.prompt_tokens ?? u.input_tokens ?? 0;
  const outputTokens = u.completion_tokens ?? u.output_tokens ?? 0;
  session.usage.requests++;
  session.usage.input += inputTokens;
  session.usage.output += outputTokens;
  session.usage.cached +=
    u.prompt_tokens_details?.cached_tokens ??
    u.input_tokens_details?.cached_tokens ??
    0;
  session.usage.total += u.total_tokens ?? inputTokens + outputTokens;
}
function searchCode(query, directory = "src", limit = 24) {
  const needle = String(query || "")
    .trim()
    .toLowerCase();
  if (!needle) throw new Error("query rỗng");
  const hits = [];
  for (const file of walk(directory)) {
    const lines = readFileSync(safePath(file), "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].toLowerCase().includes(needle)) continue;
      hits.push(`${file}:${i + 1}: ${lines[i].trim().slice(0, 220)}`);
      if (hits.length >= Math.min(40, Math.max(1, Number(limit) || 24)))
        return hits;
    }
  }
  return hits;
}
function patchFiles(patch) {
  return [...patch.matchAll(/^\+\+\+ b\/(.+)$/gm)].map((match) =>
    match[1].trim(),
  );
}
function allowedCommand(command) {
  if (!command || /[;&|`$<>]/.test(command)) return false;
  return [
    /^npm test(?:\s.*)?$/,
    /^npm run (?:typecheck|test|format|format:check|quality|package|smoke|evaluate:routes)(?:\s.*)?$/,
    /^node --test(?:\s.*)?$/,
    /^node scripts\/[\w./-]+\.mjs(?:\s.*)?$/,
    /^npx prettier (?:--check|--write)(?:\s.*)?$/,
    /^git (?:status|diff|log)(?:\s.*)?$/,
  ].some((pattern) => pattern.test(command));
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_code",
      description:
        "Tìm symbol/chuỗi và trả file:line. Luôn dùng trước khi đọc source nếu chưa biết vị trí.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          directory: { type: "string" },
          max_results: { type: "integer" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file_range",
      description:
        "Đọc đúng range source có line numbers; hard cap 180 dòng/lần.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          start_line: { type: "integer" },
          end_line: { type: "integer" },
        },
        required: ["path", "start_line", "end_line"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description:
        "Exact replacement cho sửa nhỏ; ưu tiên hơn xuất lại nguyên file.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          old_string: { type: "string" },
          new_string: { type: "string" },
        },
        required: ["path", "old_string", "new_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_patch",
      description:
        "Áp unified git patch. Ưu tiên cho thay đổi nhiều đoạn/nhiều file để giảm output token.",
      parameters: {
        type: "object",
        properties: { patch: { type: "string" } },
        required: ["patch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description: "Review diff hiện tại; paths tối đa 8.",
      parameters: {
        type: "object",
        properties: { paths: { type: "array", items: { type: "string" } } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description:
        "Chạy validation allowlist: tests/typecheck/quality/format/smoke hoặc git status/diff/log. Không dùng để đọc source.",
      parameters: {
        type: "object",
        properties: { command: { type: "string" } },
        required: ["command"],
      },
    },
  },
];

function executeTool(session, name, args) {
  try {
    if (session.tools >= session.budget.tools)
      throw new Error("tool budget exhausted");
    session.tools++;
    if (name === "search_code") {
      const hits = searchCode(
        args.query,
        args.directory || "src",
        args.max_results || 24,
      );
      return {
        ok: true,
        content: hits.join("\n") || "NO MATCHES",
        summary: `search '${args.query}': ${hits.length} hit(s)`,
      };
    }
    if (name === "read_file_range") {
      const path = String(args.path || "");
      if (
        !session.files.has(path) &&
        session.files.size >= session.budget.files
      )
        throw new Error("file read budget exhausted");
      const lines = readFileSync(safePath(path), "utf8").split("\n");
      const start = Math.max(
        1,
        Math.min(lines.length, Number(args.start_line) || 1),
      );
      const remaining = session.budget.lines - session.lines;
      if (remaining <= 0) throw new Error("line read budget exhausted");
      const end = Math.min(
        lines.length,
        Number(args.end_line) || start,
        start + MAX_RANGE - 1,
        start + remaining - 1,
      );
      const part = lines.slice(start - 1, end);
      session.files.add(path);
      session.lines += part.length;
      return {
        ok: true,
        content: `FILE ${path} ${start}-${end}/${lines.length}\n${part.map((line, i) => `${start + i}| ${line}`).join("\n")}`,
        summary: `read ${path}:${start}-${end}`,
      };
    }
    if (name === "edit_file") {
      const path = String(args.path || "");
      const full = safePath(path);
      const before = readFileSync(full, "utf8");
      const oldText = String(args.old_string ?? "");
      const newText = String(args.new_string ?? "");
      if (!oldText || oldText.length + newText.length > MAX_PATCH)
        throw new Error("edit too large/empty");
      const first = before.indexOf(oldText);
      if (first < 0 || before.indexOf(oldText, first + oldText.length) >= 0)
        throw new Error("old_string missing or not unique");
      writeFileSync(full, before.replace(oldText, newText), "utf8");
      session.changed.add(path);
      return {
        ok: true,
        content: `SUCCESS edited ${path}`,
        summary: `edited ${path}`,
      };
    }
    if (name === "apply_patch") {
      const patch = String(args.patch || "");
      if (!patch.trim() || patch.length > MAX_PATCH)
        throw new Error(`patch must be 1..${MAX_PATCH} chars`);
      const files = patchFiles(patch);
      if (!files.length) throw new Error("patch needs +++ b/<path>");
      for (const file of files) safePath(file);
      execFileSync("git", ["apply", "--check", "--whitespace=nowarn", "-"], {
        cwd: ROOT,
        input: patch,
        encoding: "utf8",
        timeout: 15_000,
      });
      execFileSync("git", ["apply", "--whitespace=nowarn", "-"], {
        cwd: ROOT,
        input: patch,
        encoding: "utf8",
        timeout: 15_000,
      });
      files.forEach((file) => session.changed.add(file));
      return {
        ok: true,
        content: `SUCCESS patched ${files.join(", ")}`,
        summary: `patched ${files.join(", ")}`,
      };
    }
    if (name === "git_diff") {
      const paths = Array.isArray(args.paths) ? args.paths.slice(0, 8) : [];
      paths.forEach(safePath);
      const text = execFileSync(
        "git",
        ["diff", "--unified=3", ...(paths.length ? ["--", ...paths] : [])],
        { cwd: ROOT, encoding: "utf8", timeout: 15_000 },
      );
      return {
        ok: true,
        content: compact(text || "NO DIFF", 10_000),
        summary: `reviewed diff${paths.length ? `: ${paths.join(", ")}` : ""}`,
      };
    }
    if (name === "run_command") {
      const command = String(args.command || "").trim();
      if (!allowedCommand(command))
        throw new Error("command outside validation allowlist");
      const result = local(
        command,
        command.includes("smoke") ? 120_000 : 60_000,
      );
      if (!result.ok) session.failures++;
      if (command === "npm run quality" && result.ok) session.quality = true;
      return {
        ok: result.ok,
        content: commandResult(result),
        summary: `${command}: ${result.ok ? "PASS" : "FAIL"}`,
      };
    }
    throw new Error(`unknown tool ${name}`);
  } catch (error) {
    session.failures++;
    return {
      ok: false,
      content: `ERROR ${name}: ${error.message || error}`,
      summary: `${name} failed: ${error.message || error}`,
    };
  }
}

const SYSTEM = `
Bạn là ASTRA GAME DIRECTOR, senior game engineer trực tiếp phát triển Xe Ôm Chaos Saigon.

PROJECT
- Native ES modules; deterministic fixed-tick 60fps simulation.
- Gameplay/simulation: src/game/*, src/world/*.
- PlayCanvas 2 là renderer visual đang được phát triển: PlayCanvasScene.js, PlayCanvasBaseMap.js và các PlayCanvas visual pass. Three.js là legacy renderer; không sửa ngoài scope.
- CI quality = typecheck + tests + Prettier; browser smoke kiểm tra renderer/gameplay.

TOKEN RULES — BẮT BUỘC
1. Không scan repo. search_code trước; chỉ read_file_range đúng vùng cần thiết.
2. Không đọc lại code/log đã có trong EXECUTION STATE.
3. Ưu tiên edit_file hoặc apply_patch; không xuất lại nguyên file.
4. Tool độc lập nên gọi song song trong cùng một model turn.
5. Máy local làm search/diff/format/tests. Đừng tiêu reasoning để mô tả terminal work.
6. Targeted validation trước; full npm run quality chỉ ở final gate.
7. Giải quyết đúng goal/deficiency lớn nhất trong scope; không opportunistic refactor.

QUALITY
- Visual: thay đổi phải thấy rõ trong street/player view, giữ readability/performance và không đụng gameplay/camera/traffic/collision nếu ngoài scope.
- Physics/traffic/collision: giữ deterministic behavior và validation/regression test liên quan.
- Không reset/checkout/clean/revert thay đổi sẵn có của người dùng.

Khi xong, trả lời tiếng Việt ngắn: sửa gì, file nào, validation pass/fail, rủi ro còn lại. Không dán code dài.
`.trim();

function messagesFor(task, session, repoSnapshot, pending) {
  const state = compact(
    session.state.map((x) => `- ${x}`).join("\n") || "- none",
    6_000,
  );
  const dynamic = `PROFILE ${session.profile}; BUDGET ${session.name}; model ${session.calls}/${session.budget.model}; tools ${session.tools}/${session.budget.tools}; read ${session.lines}/${session.budget.lines} lines; files ${session.files.size}/${session.budget.files}; changed ${[...session.changed].join(", ") || "none"}; quality ${session.quality ? "PASS" : "pending"}.\nSTART SNAPSHOT:\n${repoSnapshot}\nEXECUTION STATE:\n${state}`;
  const messages = [
    { role: "system", content: `${SYSTEM}\n\n${dynamic}` },
    { role: "user", content: task },
  ];
  if (pending) messages.push(pending.assistant, ...pending.tools);
  return messages;
}
function finalGate(session) {
  if (!session.changed.size || session.quality || session.gateTried)
    return false;
  session.gateTried = true;
  console.log(`${C.yellow}🧪 local final gate: npm run quality${C.reset}`);
  const result = local("npm run quality", 120_000);
  if (result.ok) {
    session.quality = true;
    remember(session, "automatic npm run quality: PASS");
    console.log(`${C.green}✓ quality PASS${C.reset}`);
    return false;
  }
  session.failures++;
  session.gateTried = false;
  remember(
    session,
    `automatic npm run quality: FAIL ${compact(commandResult(result), 1_700)}`,
  );
  console.log(`${C.red}✗ quality FAIL; trả log đã nén cho Astra sửa${C.reset}`);
  return true;
}

const client = createLLMClient();
async function runTask(task, requestedBudget) {
  const taskProfile = profile(task);
  const name = budgetNameFor(taskProfile, requestedBudget);
  const session = newSession(taskProfile, name);
  const repoSnapshot = snapshot();
  let pending = null;
  let finalText = "";
  console.log(
    `\n${C.bg} ASTRA GAME DIRECTOR ${C.reset} ${C.dim}${taskProfile}/${name}${C.reset}`,
  );
  console.log(`${C.bold}Task:${C.reset} ${task}`);
  console.log(
    `${C.dim}Budget: ${session.budget.model} model · ${session.budget.tools} tools · ${session.budget.lines} lines · ${session.budget.files} files${C.reset}\n`,
  );

  while (session.calls < session.budget.model) {
    session.calls++;
    const effort = reasoning(session, session.calls);
    const messages = messagesFor(task, session, repoSnapshot, pending);
    console.log(
      `${C.dim}--- call ${session.calls}/${session.budget.model} · reasoning=${effort} · ~${Math.ceil(JSON.stringify(messages).length / 4).toLocaleString()} input tokens before tool schema ---${C.reset}`,
    );
    let response;
    try {
      const hasTools = session.tools < session.budget.tools;
      response = await client.chatCompletion({
        messages,
        ...(hasTools ? { tools: TOOLS, tool_choice: "auto" } : {}),
        reasoning_effort: effort,
        max_tokens: session.budget.output,
      });
    } catch (error) {
      console.error(`${C.red}Gateway error:${C.reset}`, error.message || error);
      break;
    }
    usage(session, response);
    pending = null;
    const message = response.choices?.[0]?.message;
    if (!message) break;
    if (message.content?.trim())
      console.log(
        `${C.green}Astra:${C.reset} ${compact(message.content, 1_500)}\n`,
      );
    const calls = message.tool_calls || [];
    if (!calls.length) {
      finalText = message.content?.trim() || "Hoàn thành.";
      if (finalGate(session) && session.calls < session.budget.model) {
        finalText = "";
        continue;
      }
      break;
    }
    session.lastTools = calls.map((call) => call.function.name);
    const toolMessages = [];
    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {}
      console.log(
        `${C.yellow}⚡ ${call.function.name}${C.reset} ${C.dim}${compact(JSON.stringify(args), 160)}${C.reset}`,
      );
      const result = executeTool(session, call.function.name, args);
      remember(session, result.summary);
      console.log(`  ↳ ${compact(result.content, 360)}`);
      toolMessages.push({
        role: "tool",
        tool_call_id: call.id,
        content: compact(result.content),
      });
    }
    pending = {
      assistant: {
        role: "assistant",
        content: message.content ? compact(message.content, 800) : null,
        tool_calls: message.tool_calls,
      },
      tools: toolMessages,
    };
  }

  if (!finalText) {
    const needsRepair = finalGate(session);
    finalText = needsRepair
      ? "Hết model budget khi quality còn fail."
      : "Dừng tại budget hiện tại; xem summary.";
  }
  const u = session.usage;
  console.log(`\n${C.cyan}${C.bold}🏁 ${finalText}${C.reset}`);
  console.log(
    `${C.dim}Usage: ${u.requests} requests · input ${u.input.toLocaleString()} · cached ${u.cached.toLocaleString()} · output ${u.output.toLocaleString()} · total ${u.total.toLocaleString()} tokens${C.reset}`,
  );
  console.log(
    `${C.dim}Local: ${session.tools} tools · ${session.lines} lines/${session.files.size} files · changed ${[...session.changed].join(", ") || "none"} · quality ${session.quality ? "PASS" : "pending"}${C.reset}\n`,
  );
}

function parseArgs(argv) {
  let budget = process.env.ASTRA_AGENT_BUDGET || "";
  const task = [];
  for (const arg of argv) {
    if (arg.startsWith("--budget=")) budget = arg.slice(9);
    else task.push(arg);
  }
  if (budget && !BUDGETS[budget])
    throw new Error("--budget phải là small|normal|large");
  return { task: task.join(" ").trim(), budget: budget || undefined };
}
const cli = parseArgs(process.argv.slice(2));
if (cli.task) {
  await runTask(cli.task, cli.budget);
  process.exit(0);
}

console.clear();
console.log(`${C.bg} ASTRA GAME DIRECTOR — XE ÔM CHAOS ${C.reset}`);
console.log(
  `${C.dim}Local tools làm việc cơ học; Astra chỉ dùng token cho quyết định/code/review.${C.reset}`,
);
console.log(
  `CLI có ${C.yellow}--budget=small|normal|large${C.reset}. Gõ exit để thoát.\n`,
);
const rl = readline.createInterface({ input, output });
while (true) {
  const task = (
    await rl.question(`${C.cyan}${C.bold}astra> ${C.reset}`)
  ).trim();
  if (!task) continue;
  if (["exit", "quit"].includes(task)) {
    rl.close();
    process.exit(0);
  }
  await runTask(task);
}
