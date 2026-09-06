import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createLLMClient, EXPERIENTIAL_CONFIG } from "../src/platform/LLM.js";

// 1. Auto-load .env if present
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
      if (key && val && !process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

console.log(
  "🚀 Testing Experiential Gateway for model:",
  EXPERIENTIAL_CONFIG.model,
);
console.log("🌐 Base URL:", EXPERIENTIAL_CONFIG.baseURL);

const key = process.env.EXPLABS_API_KEY;
if (!key || key.trim() === "") {
  console.error("\n❌ [STOP] EXPLABS_API_KEY is not set!");
  console.error("Please create one under Settings -> API keys and export it:");
  console.error('  export EXPLABS_API_KEY="your_api_key_here"');
  console.error(
    "Or add it to /home/thunder/Code/xe-om-chaos/.env:\n  EXPLABS_API_KEY=your_api_key_here\n",
  );
  process.exit(1);
}

const client = createLLMClient();

try {
  console.log(
    "📡 Sending test chat completion request to Experiential gateway...",
  );
  const startTime = Date.now();

  const response = await client.chatCompletion({
    messages: [
      {
        role: "user",
        content:
          "Hello from Xe Om Chaos! Confirm that you are gpt-6-astra running through the Experiential gateway.",
      },
    ],
  });

  const duration = Date.now() - startTime;
  console.log(`\n✅ Response received successfully in ${duration}ms!\n`);

  const choice = response.choices?.[0];
  const reply = choice?.message?.content || "(empty reply)";

  console.log("----------------- MODEL REPLY -----------------");
  console.log(reply);
  console.log("-----------------------------------------------");

  const usage = response.usage || {};
  console.log("\n📊 TOKEN USAGE BREAKDOWN:");
  console.log(`  - Prompt Tokens:     ${usage.prompt_tokens ?? "N/A"}`);
  console.log(`  - Completion Tokens: ${usage.completion_tokens ?? "N/A"}`);
  console.log(`  - Total Tokens:      ${usage.total_tokens ?? "N/A"}`);
  console.log(
    `  - Model ID:          ${response.model || EXPERIENTIAL_CONFIG.model}`,
  );
  console.log("\n🎉 Verified: Successfully running on Experiential credits!");
} catch (err) {
  console.error("\n❌ Request failed:", err?.message || err);
  process.exit(1);
}
