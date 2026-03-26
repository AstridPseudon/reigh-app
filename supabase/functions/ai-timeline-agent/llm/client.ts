import type { EdgeRuntime } from "../../_shared/edgeRequest.ts";
import { toErrorMessage } from "../../_shared/errorMessage.ts";
import { LLM_TIMEOUT_MS, OPENROUTER_URL } from "../config.ts";
import type { OpenRouterParams, OpenRouterResponse } from "../types.ts";

type LlmLogger = Pick<EdgeRuntime["logger"], "error" | "info">;

async function callOpenRouter(
  params: OpenRouterParams,
  logger: LlmLogger,
): Promise<OpenRouterResponse> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("[ai-timeline-agent] Missing OPENROUTER_API_KEY");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    console.log(
      `[agent] OpenRouter request: model=${params.model} messages=${params.messages.length} tools=${params.tools?.length ?? 0}`,
    );
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://reigh.app",
        "X-Title": "Reigh Timeline Agent",
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[agent] OpenRouter error ${response.status}: ${text.slice(0, 500)}`);
      throw new Error(`OpenRouter ${response.status}: ${text}`);
    }

    const data = await response.json() as OpenRouterResponse;
    const msg = data.choices?.[0]?.message;
    console.log(
      `[agent] OpenRouter response: tool_calls=${msg?.tool_calls?.length ?? 0} content_length=${msg?.content?.length ?? 0} usage=${JSON.stringify(data.usage ?? {})}`,
    );
    logger.info("OpenRouter response received", {
      model: params.model,
      usage: data.usage,
    });
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function invokeLlmWithRetry(
  params: OpenRouterParams,
  logger: LlmLogger,
): Promise<OpenRouterResponse> {
  try {
    return await callOpenRouter(params, logger);
  } catch (firstError: unknown) {
    logger.error("OpenRouter call failed on first attempt", {
      error: toErrorMessage(firstError),
    });

    try {
      return await callOpenRouter(params, logger);
    } catch (secondError: unknown) {
      logger.error("OpenRouter call failed on retry", {
        error: toErrorMessage(secondError),
      });
      throw secondError;
    }
  }
}
