/**
 * Experiential Labs Gateway Client for "gpt-6-astra"
 * Speaks the OpenAI-compatible Chat Completions API.
 */

export const EXPERIENTIAL_CONFIG = {
  baseURL: "https://api.experientiallabs.ai/v1",
  model: "gpt-6-astra",
  envKeyName: "EXPLABS_API_KEY",
  reasoningEffort: "xhigh",
};

/**
 * Retrieves the Experiential API key.
 * If not set, throws an informative error instructing how to configure it.
 * @returns {string}
 */
export function getApiKey() {
  const globalObj = /** @type {any} */ (globalThis);
  const key =
    globalObj.process?.env?.[EXPERIENTIAL_CONFIG.envKeyName] ||
    globalObj.__EXPLABS_API_KEY;

  if (!key || key.trim() === "") {
    throw new Error(
      `[Experiential Gateway] ${EXPERIENTIAL_CONFIG.envKeyName} is not set.\n` +
        `Please create one under Settings -> API keys and export it:\n` +
        `  export EXPLABS_API_KEY="your_api_key_here"\n` +
        `Or add it to /home/thunder/Code/xe-om-chaos/.env`,
    );
  }
  return key.trim();
}

/**
 * Builds an LLM client configured for gpt-6-astra via Experiential Labs gateway.
 * @param {Object} [options]
 * @param {string} [options.apiKey] - Optional override key
 * @param {string} [options.baseURL] - Base URL (defaults to https://api.experientiallabs.ai/v1)
 * @param {string} [options.model] - Model id (defaults to gpt-6-astra)
 * @param {string} [options.reasoning_effort] - Reasoning effort (e.g. 'xhigh')
 */
export function createLLMClient(options = {}) {
  const baseURL = options.baseURL || EXPERIENTIAL_CONFIG.baseURL;
  const model = options.model || EXPERIENTIAL_CONFIG.model;

  return {
    baseURL,
    model,

    /**
     * Executes a chat completion request. Preserves tool calls and streaming.
     * @param {Object} params
     * @param {Array<{role: string, content: string|Array<any>}>} params.messages
     * @param {boolean} [params.stream]
     * @param {string} [params.reasoning_effort]
     * @param {Array<any>} [params.tools]
     * @param {string|Object} [params.tool_choice]
     * @param {number} [params.temperature]
     * @param {number} [params.max_tokens]
     * @returns {Promise<Response|any>}
     */
    async chatCompletion(params) {
      const apiKey = options.apiKey || getApiKey();
      const endpoint = `${baseURL.replace(/\/+$/, "")}/chat/completions`;

      const payload = {
        model,
        messages: params.messages,
        stream: params.stream ?? false,
        reasoning_effort:
          params.reasoning_effort ||
          options.reasoning_effort ||
          EXPERIENTIAL_CONFIG.reasoningEffort,
        ...(params.tools ? { tools: params.tools } : {}),
        ...(params.tool_choice ? { tool_choice: params.tool_choice } : {}),
        ...(params.max_tokens !== undefined
          ? { max_tokens: params.max_tokens }
          : {}),
      };

      let attempt = 0;
      const maxRetries = 3;
      const delays = [1500, 3000, 5000];

      while (attempt <= maxRetries) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const isTransient =
              response.status === 429 ||
              response.status === 502 ||
              response.status === 503 ||
              response.status === 504;

            if (isTransient && attempt < maxRetries) {
              await new Promise((resolve) =>
                setTimeout(resolve, delays[attempt] || 2000),
              );
              attempt++;
              continue;
            }

            const errorText = await response.text();
            throw new Error(
              `[Experiential Gateway] Request failed (HTTP ${response.status}): ${errorText}`,
            );
          }

          if (params.stream) {
            return response;
          }

          return await response.json();
        } catch (fetchErr) {
          if (attempt >= maxRetries) throw fetchErr;
          attempt++;
          await new Promise((resolve) =>
            setTimeout(resolve, delays[attempt - 1] || 1500),
          );
        }
      }
    },
  };
}
