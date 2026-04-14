const OUTPUT_ONLY_PROMPT_POLICY = `CRITICAL FORMATTING REQUIREMENTS:
- Output ONLY the revised prompt text
- NO additional commentary, explanations, or formatting
- NO quotation marks around the output`;

export function buildGeneratePromptsMessages(input: {
  overallPromptText: string;
  rulesToRememberText: string;
  numberToGenerate: number;
  existingPrompts: unknown[];
  variationIntent?: string;
}): { systemMsg: string; userMsg: string } {
  const {
    overallPromptText,
    rulesToRememberText,
    numberToGenerate,
    existingPrompts,
    variationIntent,
  } = input;

  const resolvedRequest = overallPromptText || "Please generate general image prompts based on the overall goal and rules.";
  const trimmedIntent = typeof variationIntent === "string" ? variationIntent.trim() : "";
  const hasIntent = trimmedIntent.length > 0;

  const systemMsg = `You generate image generation prompts that vary along a specified axis while holding everything else fixed. Output only the prompts, one per line, with no numbering, bullets, or quotes.`;

  const axisBlock = hasIntent
    ? `VARIATION AXIS: ${trimmedIntent}
Vary each prompt along this axis. Keep every other element from BASE PROMPT identical across all ${numberToGenerate} outputs — same subject, same characters, same mood, same composition — only the specified axis changes.

EXAMPLE — BASE PROMPT: "a red fox sitting in a forest clearing at dusk" with axis "different camera angles":
a red fox sitting in a forest clearing at dusk, shot from a low ground-level angle
an overhead aerial view of a red fox sitting in a forest clearing at dusk
a red fox sitting in a forest clearing at dusk, tight over-the-shoulder framing from behind the fox

EXAMPLE — BASE PROMPT: "a woman drinking coffee in a sunny kitchen" with axis "different lighting conditions":
a woman drinking coffee in a sunny kitchen under bright midday sun streaming through the windows
a woman drinking coffee in a sunny kitchen lit by soft early-morning golden hour light
a woman drinking coffee in a sunny kitchen with overcast grey daylight filtering through sheer curtains`
    : `DEFAULT MODE — LINGUISTIC REWRITES:
Express the exact same concept ${numberToGenerate} different ways. Every prompt describes the identical subject, scene, mood, characters, details, and composition. Only vary sentence structure, word order, synonyms, clause ordering, and phrasing. Do not introduce new elements, details, styles, or scenarios. Do not change the setting, time of day, weather, or any visual content. This is paraphrase, not variation.

EXAMPLE — BASE PROMPT: "a red fox sitting in a forest clearing at dusk":
a red fox sitting in a forest clearing at dusk
at dusk, a red fox is sitting in a clearing in the forest
in a forest clearing, a red fox sits as dusk settles

EXAMPLE — BASE PROMPT: "a woman drinking coffee in a sunny kitchen":
a woman drinking coffee in a sunny kitchen
in a sunny kitchen, a woman is drinking coffee
a woman sips coffee inside a kitchen filled with sunlight`;

  let instructions = `BASE PROMPT: ${resolvedRequest}

ADDITIONAL RULES: ${rulesToRememberText || "(none)"}

${axisBlock}

FORMAT:
- Output exactly ${numberToGenerate} prompts
- One prompt per line
- No numbering, no bullets, no quotes, no blank lines, no markdown`;

  if (existingPrompts.length) {
    const ctx = existingPrompts
      .map((prompt) => `- ${typeof prompt === "string" ? prompt : (prompt as Record<string, unknown>)?.text ?? ""}`)
      .join("\n");
    instructions += `\n\nExisting prompts already generated (do not repeat these verbatim):\n${ctx}`;
  }

  instructions += `

Output the ${numberToGenerate} prompts now.`;

  return {
    systemMsg,
    userMsg: instructions,
  };
}

export function buildEditPromptMessages(input: {
  originalPromptText: string;
  editInstructions: string;
}): { systemMsg: string; userMsg: string } {
  const { originalPromptText, editInstructions } = input;

  const systemMsg = `You are an AI assistant that helps refine user prompts for image generation. Edit the provided prompt based on the user's instructions while maintaining optimization for AI image generation.`;
  const userMsg = `Original Image Prompt: ${originalPromptText}

Edit Instructions: ${editInstructions}

GUIDELINES:
- Only change what is specifically requested in the edit instructions
- Do not add specific artistic styles (like 'photography', 'anime', 'oil painting', 'digital art', etc.) unless specifically requested
- Focus on describing the subject, scene, composition, lighting, and visual details
- Keep it optimized for AI image generation with detailed visual descriptions

${OUTPUT_ONLY_PROMPT_POLICY}

Revised Prompt:`;

  return { systemMsg, userMsg };
}

export const ENHANCE_SEGMENT_SYSTEM_PROMPT = `You are an expert at creating motion-focused video generation prompts. You analyze start and end frames and create vivid descriptions of the motion and transitions between them.

CRITICAL RULES:
- If the user gives a direct prompt, PRESERVE their exact wording - do not paraphrase or embellish with synonyms
- Output ONLY your three-sentence prompt
- NO quotation marks, labels, explanations, or commentary
- Do NOT include "SENTENCE 1:", "SENTENCE 2:", etc. labels
- Just output the three sentences directly`;

export function buildEnhanceSegmentUserPrompt(prompt: string): string {
  return `You are viewing two images side by side: the LEFT image (with GREEN border) shows the STARTING frame, and the RIGHT image (with RED border) shows the ENDING frame of a video sequence.

The user's input is: '${prompt}'

CRITICAL - DETERMINE THE USER'S INTENT:
1. If the user's input already reads like a DIRECT PROMPT (describes visuals, camera movement, scene elements in complete sentences), PRESERVE THEIR EXACT WORDING as much as possible. Only expand to three sentences if needed, using their original phrasing as the foundation.
2. If the user's input is INSTRUCTIONS (e.g., "describe...", "make it more...", "add...") or a brief description that needs elaboration, then create a detailed three-sentence prompt.

EXAMPLES OF DIRECT PROMPTS (preserve these):
- "the camera flies through the sky to the distant hills as the snow storm begins" -> This IS the prompt. Keep this wording.
- "A woman walks through the garden as petals fall around her" -> This IS the prompt. Keep this wording.

EXAMPLES OF INSTRUCTIONS (elaborate these):
- "describe the camera moving through clouds" -> User wants you to write the prompt
- "something dramatic with a storm" -> User wants you to create details
- "make it cinematic" -> User wants elaboration

FOCUS ON MOTION: Describe what MOVES, what CHANGES, and HOW things transition between these frames. Everything should be described in terms of motion and transformation, not static states.

YOUR RESPONSE MUST FOLLOW THIS EXACT STRUCTURE:

SENTENCE 1 (PRIMARY MOTION): Describe the main action, camera movement, and major scene transitions. What is the dominant movement happening?

SENTENCE 2 (MOVING ELEMENTS): Describe how the characters, objects, and environment are moving or changing. Focus on what's in motion and how it moves through space.

SENTENCE 3 (MOTION DETAILS): Describe the subtle motion details - secondary movements, environmental dynamics, particles, lighting shifts, and small-scale motions.

Examples of MOTION-FOCUSED descriptions:

- "The sun rises rapidly above the jagged peaks as the camera tilts upward from the dark valley floor. The silhouette pine trees sway gently against the shifting violet and gold sky as the entire landscape brightens. Wisps of morning mist evaporate and drift upward from the river surface while distant birds circle and glide through the upper left corner."

- "A woman sprints from the kitchen into the bright exterior sunlight as the camera pans right to track her accelerating path. Her vintage floral dress flows and ripples in the wind while colorful playground equipment blurs past in the background. Her hair whips back dynamically and dust particles kick up and swirl around her sneakers as she impacts the gravel."

- "The camera zooms aggressively inward into a macro shot of an eye as the brown horse reflection grows larger and more detailed. The iris textures shift under the changing warm lighting while the biological details come into sharper focus. The pupil constricts and contracts in reaction to the light while the tiny reflected horse tosses its mane and shifts position."

Now create your THREE-SENTENCE MOTION-FOCUSED description based on: '${prompt}'

FINAL REMINDER: If the user's input already sounds like a prompt (describes camera, motion, scene), USE THEIR EXACT WORDS. Do not replace "flies" with "soars", "sky" with "turbulent sky", "snow storm begins" with "first snowflakes swirl". Keep their language intact.`;
}
