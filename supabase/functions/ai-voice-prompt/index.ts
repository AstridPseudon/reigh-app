/* eslint-disable */
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { bootstrapEdgeHandler, NO_SESSION_RUNTIME_OPTIONS } from "../_shared/edgeHandler.ts";
import { jsonResponse } from "../_shared/http.ts";
import { getGroqClient, transcribeAudio } from "../_shared/transcription.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  const bootstrap = await bootstrapEdgeHandler(req, {
    functionName: "ai-voice-prompt",
    logPrefix: "[AI-VOICE-PROMPT]",
    method: "POST",
    corsPreflight: false,
    parseBody: "none",
    auth: {
      required: true,
      options: { allowJwtUserAuth: true },
    },
    ...NO_SESSION_RUNTIME_OPTIONS,
  });
  if (!bootstrap.ok) {
    return bootstrap.response;
  }

  const { logger } = bootstrap.value;

  try {
    const groq = getGroqClient();

    // Handle multipart form data for audio upload OR JSON for text instructions
    const contentType = req.headers.get("content-type") || "";
    
    let audioFile: File | null = null;
    let textInstructions: string | null = null;
    let task: string = "transcribe_and_write";
    let context: string = "";
    let example: string = "";
    let existingValue: string = "";
    
    if (contentType.includes("application/json")) {
      // JSON body with text instructions (skip transcription)
      const body = await req.json();
      textInstructions = body.textInstructions || null;
      task = body.task || "transcribe_and_write";
      context = body.context || "";
      example = body.example || "";
      existingValue = body.existingValue || "";
      
      if (!textInstructions) {
        return jsonResponse({ error: "textInstructions is required for JSON requests" }, 400);
      }
      logger.info('Text instructions received', { preview: textInstructions.substring(0, 100) });
    } else {
      // Multipart form data with audio file
      const formData = await req.formData();
      audioFile = formData.get("audio") as File | null;
      task = formData.get("task") as string || "transcribe_and_write";
      context = formData.get("context") as string || "";
      example = formData.get("example") as string || "";
      existingValue = formData.get("existingValue") as string || "";

      if (!audioFile) {
        return jsonResponse({ error: "audio file is required" }, 400);
      }

      logger.info('Received audio file', { name: audioFile.name, size: audioFile.size, type: audioFile.type });
    }
    
    if (existingValue) {
      logger.info('Existing value provided', { chars: existingValue.length });
    }

    // Determine transcribed text - either from audio or use text instructions directly
    let transcribedText: string;
    
    if (textInstructions) {
      // Skip transcription - use text instructions directly
      transcribedText = textInstructions;
    } else if (audioFile) {
      // Step 1: Transcribe audio using Whisper
      transcribedText = await transcribeAudio(groq, audioFile);
      logger.info('Transcription complete', { preview: transcribedText.substring(0, 100) });

      if (!transcribedText) {
        return jsonResponse({ error: "No speech detected in audio" }, 400);
      }

      // If task is just transcribe, return the raw text
      if (task === "transcribe_only") {
        return jsonResponse({ 
          success: true, 
          transcription: transcribedText,
          usage: null 
        });
      }
    } else {
      return jsonResponse({ error: "Either audio file or textInstructions is required" }, 400);
    }

    // Step 2: Classify intent — is the user dictating a prompt or requesting a rewrite?
    const classifyMsg = `You classify spoken input for an AI image generation tool. Decide whether the user is:

DIRECT: Dictating actual prompt content — describing a scene, subject, or concept they want to generate. They are telling you WHAT to create. Examples:
- "a woman walking through a forest at sunset"
- "cyberpunk cityscape with neon lights and rain"
- "close-up portrait, soft lighting, film grain"
- "an old man sitting on a bench reading a newspaper"

REWRITE: Giving meta-instructions about what kind of prompt they want — asking for help, elaboration, expansion, modification, or describing what they want indirectly. Examples:
- "something like a dramatic landscape, make it moody"
- "blur, distortion, and similar quality issues"
- "make it more cinematic"
- "like the previous one but at night"
- "expand on this, add more detail"
- "I want something with a vintage feel, maybe some film grain"
${existingValue ? `- Any request to modify, extend, or build on the existing content` : ""}

Respond with ONLY the word "direct" or "rewrite".`;

    logger.info('Classifying transcription intent...');
    let intent: "direct" | "rewrite" = "rewrite"; // default to rewrite for safety
    try {
      const classifyResp = await groq.chat.completions.create({
        model: "moonshotai/kimi-k2-instruct",
        messages: [
          { role: "system", content: classifyMsg },
          { role: "user", content: `INPUT: "${transcribedText}"${existingValue ? `\nEXISTING FIELD CONTENT: "${existingValue}"` : ""}` },
        ],
        temperature: 0,
        max_tokens: 8,
      });
      const raw = classifyResp.choices[0]?.message?.content?.trim().toLowerCase() || "";
      intent = raw.startsWith("direct") ? "direct" : "rewrite";
      logger.info('Intent classified', { intent, raw });
    } catch (classifyError: unknown) {
      logger.warn('Classification failed, defaulting to rewrite', { error: classifyError?.message || String(classifyError) });
    }

    let promptText: string;
    let usage: unknown = null;

    if (intent === "direct") {
      // Clean filler words but preserve the prompt as-is
      promptText = transcribedText
        .replace(/\b(um|uh|like|you know|I mean|so|well|okay so|right)\b\s*/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      logger.info('Direct prompt (cleaned)', { preview: promptText.substring(0, 100) });
    } else {
      // Step 3: Rewrite via Kimi
      const systemMsg = `You are a helpful assistant that transforms spoken instructions into appropriate text for AI generation fields. You interpret the user's INTENT, not just their literal words.

Key skill: Recognize when users are giving INSTRUCTIONS vs LITERAL CONTENT:
- "blur, distortion, and similar quality issues" → User wants a LIST of quality issues, expand it
- "something like a sunset over mountains" → User is describing what they want, elaborate on it
- "make it more dramatic" → User wants you to modify existing content
- "just write: a cat sitting on a windowsill" → User wants EXACT text, transcribe literally

Sometimes users want direct transcription without enhancement. If they say "just", "exactly", "literally", or similar, output their words verbatim.`;

      let userMsg = `Transform this spoken input into appropriate text for the given context.

SPOKEN INPUT: "${transcribedText}"
${existingValue ? `
EXISTING CONTENT IN FIELD: "${existingValue}"
(The user may want to modify, extend, or replace this based on their spoken input)
` : ""}
${context ? `CONTEXT (important - this tells you what kind of field this is):
${context}

` : ""}${example ? `EXAMPLE of what good output looks like for this field:
"${example}"

` : ""}INTERPRETATION GUIDELINES:
- CRITICAL: Interpret the user's INTENT, not just literal words
- If they say "X, Y, and similar things" or "stuff like X" or "things like X" → Generate an expanded list of similar items
- If they say "and so on" or "etc" or "that kind of thing" → Expand with more examples
- If they give examples followed by ellipsis or trailing off → They want more of the same type
- If they're describing a scene or subject → Transform into a well-crafted prompt
- If they're giving modification instructions → Apply those to the existing content
${existingValue ? "- Consider how their input relates to the existing content - are they adding, modifying, or replacing?" : ""}

CRITICAL FORMATTING:
- Output ONLY the final text, ready to use in the field
- NO commentary, explanations, or meta-text
- NO quotation marks around the output
- Match the expected format for the context (e.g., comma-separated list for negative prompts)
- AVOID keyword stuffing like "4k, best quality, masterpiece, highly detailed" unless the user specifically requests quality tags
- Ignore filler words like "um", "uh", "like", "you know" from the input
- PRESERVE specific details the user mentions: names, colors, numbers, camera angles, style references
- Be concise - quality prompts are typically 1-3 sentences, not paragraphs

Output:`;

      logger.info('Calling Kimi API for rewrite...');

      try {
        const resp = await groq.chat.completions.create({
          model: "moonshotai/kimi-k2-instruct",
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          temperature: 0.6,
          max_tokens: 2048,
          top_p: 1,
        });
        logger.info('Kimi API responded successfully');
        promptText = resp.choices[0]?.message?.content?.trim() || transcribedText;
        usage = resp.usage;
      } catch (kimiError: unknown) {
        logger.error('Kimi API error', { error: kimiError?.message || String(kimiError) });
        promptText = transcribedText;
      }
    }

    logger.info('Final prompt', { intent, preview: promptText.substring(0, 100) });

    await logger.flush();
    return jsonResponse({
      success: true,
      transcription: transcribedText,
      prompt: promptText,
      intent,
      usage,
    });

  } catch (err: unknown) {
    logger.error('Error', { error: err?.message || String(err) });
    await logger.flush();
    return jsonResponse({ error: "Internal server error", details: err?.message }, 500);
  }
});
