// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Groq from "npm:groq-sdk@0.26.0";
import {
  enforceRateLimit,
  RATE_LIMITS,
} from "../_shared/rateLimit.ts";
import { bootstrapEdgeHandler, NO_SESSION_RUNTIME_OPTIONS } from "../_shared/edgeHandler.ts";
import { jsonResponse } from "../_shared/http.ts";
import { toErrorMessage } from "../_shared/errorMessage.ts";
import {
  buildEditPromptMessages,
  buildEnhanceSegmentUserPrompt,
  buildGeneratePromptsMessages,
  ENHANCE_SEGMENT_SYSTEM_PROMPT,
} from "./templates.ts";

const GROQ_MODEL = "moonshotai/kimi-k2-instruct-0905";
const GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = 30_000;

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (groqClient) {
    return groqClient;
  }
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    throw new Error("[ai-prompt] Missing Groq provider configuration");
  }
  groqClient = new Groq({ apiKey, timeout: GROQ_TIMEOUT_MS });
  return groqClient;
}

interface GroqChatParams {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  max_tokens: number;
  top_p?: number;
}

async function groqWithFallback(
  groq: Groq,
  params: GroqChatParams,
  logger: { info: (msg: string) => void },
) {
  try {
    return await groq.chat.completions.create(params as Parameters<typeof groq.chat.completions.create>[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isModelError = msg.includes("model") || msg.includes("timeout") || msg.includes("abort") || msg.includes("could not process");
    if (isModelError && params.model !== GROQ_FALLBACK_MODEL) {
      logger.info(`[AI-PROMPT] Primary model failed (${msg}), falling back to ${GROQ_FALLBACK_MODEL}`);
      return await groq.chat.completions.create({
        ...params,
        model: GROQ_FALLBACK_MODEL,
      } as Parameters<typeof groq.chat.completions.create>[0]);
    }
    throw err;
  }
}

function getOpenAIApiKey(): string {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("[ai-prompt] Missing OpenAI provider configuration");
  }
  return apiKey;
}

serve(async (req) => {
  const bootstrap = await bootstrapEdgeHandler(req, {
    functionName: "ai-prompt",
    logPrefix: "[AI-PROMPT]",
    parseBody: "strict",
    auth: {
      required: true,
      options: { allowJwtUserAuth: true },
    },
    ...NO_SESSION_RUNTIME_OPTIONS,
  });
  if (!bootstrap.ok) {
    return bootstrap.response;
  }

  const { supabaseAdmin, logger, auth, body } = bootstrap.value;
  if (!auth?.userId && !auth?.isServiceRole) {
    return jsonResponse({ error: "Authentication failed" }, 401);
  }

  // Rate limit by user ID (skip for service role — internal agent calls)
  if (auth.userId) {
    const rateLimitDenied = await enforceRateLimit({
      supabaseAdmin,
      functionName: 'ai-prompt',
      userId: auth.userId,
      config: RATE_LIMITS.expensive,
      logger,
      logPrefix: '[AI-PROMPT]',
      responses: {
        serviceUnavailable: () => jsonResponse({ error: 'Rate limit service unavailable' }, 503),
      },
    });
    if (rateLimitDenied) {
      return rateLimitDenied;
    }
  }

  const task = body.task as string | undefined;
  if (!task) return jsonResponse({ error: "task is required" }, 400);

  try {
    switch (task) {
      case "generate_prompts": {
        const groq = getGroqClient();
        const overallPromptText = String(body.overallPromptText ?? "");
        const rulesToRememberText = String(body.rulesToRememberText ?? "");
        const numberToGenerate = Number(body.numberToGenerate ?? 3);
        const existingPrompts = Array.isArray(body.existingPrompts) ? body.existingPrompts as unknown[] : [];
        const temperature = Number(body.temperature ?? 0.8);
        const variationIntent = typeof body.variationIntent === "string" ? body.variationIntent : undefined;

        const { systemMsg, userMsg } = buildGeneratePromptsMessages({
          overallPromptText,
          rulesToRememberText,
          numberToGenerate,
          existingPrompts,
          variationIntent,
        });

        const normalizeKey = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
        const dedupe = (lines: string[]): string[] => {
          const seen = new Set<string>();
          const out: string[] = [];
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const key = normalizeKey(trimmed);
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(trimmed);
            if (out.length >= numberToGenerate) break;
          }
          return out;
        };

        logger.info(`[AI-PROMPT] generate_prompts: starting Groq call, model=${GROQ_MODEL}, numberToGenerate=${numberToGenerate}, hasVariationIntent=${Boolean(variationIntent && variationIntent.trim())}`);
        const groqStart = Date.now();
        const resp = await groqWithFallback(groq, {
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          temperature: temperature,
          max_tokens: 4096,
          top_p: 1,
        }, logger);
        logger.info(`[AI-PROMPT] generate_prompts: Groq call completed in ${Date.now() - groqStart}ms, model=${resp.model}`);
        const outputText = resp.choices[0]?.message?.content?.trim() || "";
        const rawLines = outputText.split("\n").map((s) => s.trim()).filter(Boolean);
        let prompts = dedupe(rawLines);
        let usage = resp.usage;

        logger.info(`[AI-PROMPT] generate_prompts: primary attempt, rawCount=${rawLines.length}, uniqueCount=${prompts.length}, requested=${numberToGenerate}`);

        if (prompts.length < numberToGenerate) {
          logger.info(`[AI-PROMPT] generate_prompts: unique count below target, retrying with same model at temperature 1.0`);
          const retryStart = Date.now();
          try {
            const retryResp = await groq.chat.completions.create({
              model: GROQ_MODEL,
              messages: [
                { role: "system", content: systemMsg },
                { role: "user", content: userMsg },
              ],
              temperature: 1.0,
              max_tokens: 4096,
              top_p: 1,
            } as Parameters<typeof groq.chat.completions.create>[0]);
            const retryText = retryResp.choices[0]?.message?.content?.trim() || "";
            const retryLines = retryText.split("\n").map((s) => s.trim()).filter(Boolean);
            const retryPrompts = dedupe(retryLines);
            logger.info(`[AI-PROMPT] generate_prompts: retry attempt completed in ${Date.now() - retryStart}ms, rawCount=${retryLines.length}, uniqueCount=${retryPrompts.length}`);
            if (retryPrompts.length > prompts.length) {
              prompts = retryPrompts;
              usage = retryResp.usage;
            }
          } catch (retryErr) {
            const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            logger.info(`[AI-PROMPT] generate_prompts: retry failed (${msg}), returning primary result`);
          }
        }

        return jsonResponse({ prompts, usage });
      }
      case "edit_prompt": {
        const groq = getGroqClient();
        const originalPromptText = String(body.originalPromptText ?? "");
        const editInstructions = String(body.editInstructions ?? "");
        if (!originalPromptText || !editInstructions) return jsonResponse({ error: "originalPromptText and editInstructions required" }, 400);
        const { systemMsg, userMsg } = buildEditPromptMessages({
          originalPromptText,
          editInstructions,
        });
        const resp = await groqWithFallback(groq, {
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 1,
        }, logger);
        const newText = resp.choices[0]?.message?.content?.trim() || originalPromptText;
        return jsonResponse({ success: true, newText, usage: resp.usage });
      }
      case "generate_summary": {
        const groq = getGroqClient();
        const promptText = String(body.promptText ?? "");
        if (!promptText) return jsonResponse({ error: "promptText required" }, 400);
        logger.info(`[AI-PROMPT] generate_summary: starting Groq call`);
        const summaryStart = Date.now();
        const resp = await groqWithFallback(groq, {
          model: GROQ_MODEL,
          messages: [{ role: "user", content: `Create a brief summary of this image prompt in 10 words or less. Output only the summary text with no additional formatting or quotation marks:

"${promptText}"

Summary:` }],
          temperature: 1.0,
          max_tokens: 50,
          top_p: 1,
        }, logger);
        logger.info(`[AI-PROMPT] generate_summary: Groq call completed in ${Date.now() - summaryStart}ms`);
        const summary = resp.choices[0]?.message?.content?.trim() || null;
        return jsonResponse({ summary, usage: resp.usage });
      }
      case "enhance_segment_prompt": {
        // Enhance segment prompt(s) using OpenAI GPT-5 Mini
        // Accepts either a single `prompt` string or an array `prompts` for batch processing.
        const isBatch = Array.isArray(body.prompts);
        const prompts: string[] = isBatch
          ? (body.prompts as string[]).map((p: unknown) => String(p ?? ""))
          : [String(body.prompt ?? "")];

        if (!isBatch && !prompts[0].trim()) {
          return jsonResponse({ error: "prompt is required" }, 400);
        }

        const openaiApiKey = getOpenAIApiKey();
        const systemMsg = ENHANCE_SEGMENT_SYSTEM_PROMPT;

        const MAX_RETRIES = 2;
        const RETRY_DELAY_MS = 2000;

        async function callOpenAI(p: string): Promise<Response> {
          return fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-5-mini",
              messages: [
                { role: "system", content: systemMsg },
                { role: "user", content: buildEnhanceSegmentUserPrompt(p) },
              ],
              max_completion_tokens: 16000,
            }),
          });
        }

        function delay(ms: number): Promise<void> {
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        async function enhanceOne(p: string): Promise<{ enhanced_prompt: string; usage?: unknown }> {
          if (!p.trim()) return { enhanced_prompt: "" };

          for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
              const response = await callOpenAI(p);

              if (response.status === 429) {
                console.warn(`[ai-prompt] OpenAI 429, attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
                if (attempt < MAX_RETRIES) {
                  await delay(RETRY_DELAY_MS * (attempt + 1));
                  continue;
                }
                return { enhanced_prompt: p };
              }

              if (!response.ok) {
                const errorText = await response.text();
                console.error(`[ai-prompt] OpenAI API error:`, response.status, errorText);
                return { enhanced_prompt: p };
              }

              const data = await response.json();
              return {
                enhanced_prompt: data.choices?.[0]?.message?.content?.trim() || p,
                usage: data.usage,
              };
            } catch (err) {
              console.error(`[ai-prompt] OpenAI fetch error attempt ${attempt + 1}:`, toErrorMessage(err));
              if (attempt < MAX_RETRIES) {
                await delay(RETRY_DELAY_MS * (attempt + 1));
                continue;
              }
              return { enhanced_prompt: p };
            }
          }

          return { enhanced_prompt: p };
        }

        try {
          if (!isBatch) {
            const result = await enhanceOne(prompts[0]);
            return jsonResponse(result);
          }

          // Batch: fire all concurrently server-side
          const results = await Promise.all(prompts.map(enhanceOne));
          return jsonResponse({
            enhanced_prompts: results.map(r => r.enhanced_prompt),
            usage: results.map(r => r.usage).filter(Boolean),
          });
        } catch (fetchError: unknown) {
          const message = toErrorMessage(fetchError);
          console.error(`[ai-prompt] OpenAI fetch error:`, message);
          return jsonResponse({ error: "Failed to call OpenAI API", details: message }, 500);
        }
      }
      default:
        return jsonResponse({ error: `Unknown task: ${task}` }, 400);
    }
  } catch (err: unknown) {
    const message = toErrorMessage(err);
    console.error(`[ai-prompt] Error handling task ${task}:`, message);
    return jsonResponse({ error: "Internal server error", details: message }, 500);
  }
}); 
