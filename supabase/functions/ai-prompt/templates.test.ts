import { describe, expect, it } from 'vitest';
import {
  ENHANCE_SEGMENT_SYSTEM_PROMPT,
  buildEditPromptMessages,
  buildEnhanceSegmentUserPrompt,
  buildGeneratePromptsMessages,
} from './templates.ts';

describe('ai-prompt templates', () => {
  it('builds generate prompts messages in default linguistic-rewrite mode when no variation intent is provided', () => {
    const { systemMsg, userMsg } = buildGeneratePromptsMessages({
      overallPromptText: 'A train entering a station',
      rulesToRememberText: 'Keep it cinematic',
      numberToGenerate: 3,
      existingPrompts: [],
    });

    expect(systemMsg).toContain('vary along a specified axis');
    expect(userMsg).toContain('BASE PROMPT: A train entering a station');
    expect(userMsg).toContain('DEFAULT MODE — LINGUISTIC REWRITES');
    expect(userMsg).toContain('Output exactly 3 prompts');
    expect(userMsg).not.toContain('VARIATION AXIS:');
  });

  it('switches to axis mode when variationIntent is provided', () => {
    const { userMsg } = buildGeneratePromptsMessages({
      overallPromptText: 'a woman drinking coffee',
      rulesToRememberText: '',
      numberToGenerate: 4,
      existingPrompts: [],
      variationIntent: 'different lighting conditions',
    });

    expect(userMsg).toContain('VARIATION AXIS: different lighting conditions');
    expect(userMsg).not.toContain('DEFAULT MODE');
    expect(userMsg).toContain('Output exactly 4 prompts');
  });

  it('builds generate prompts messages with existing prompt context', () => {
    const { userMsg } = buildGeneratePromptsMessages({
      overallPromptText: '',
      rulesToRememberText: '',
      numberToGenerate: 2,
      existingPrompts: [{ text: 'existing one' }, 'existing two'],
    });

    expect(userMsg).toContain('Existing prompts already generated');
    expect(userMsg).toContain('- existing one');
    expect(userMsg).toContain('- existing two');
  });

  it('builds edit prompt messages with output-only policy', () => {
    const { systemMsg, userMsg } = buildEditPromptMessages({
      originalPromptText: 'A woman walking in a forest',
      editInstructions: 'Make it foggy and dramatic',
    });

    expect(systemMsg).toContain('helps refine user prompts');
    expect(userMsg).toContain('Original Image Prompt: A woman walking in a forest');
    expect(userMsg).toContain('Edit Instructions: Make it foggy and dramatic');
    expect(userMsg).toContain('Output ONLY the revised prompt text');
  });

  it('builds enhancement user prompt and keeps system prompt guidance', () => {
    const userPrompt = buildEnhanceSegmentUserPrompt('camera flies over snowy hills');

    expect(ENHANCE_SEGMENT_SYSTEM_PROMPT).toContain('Output ONLY your three-sentence prompt');
    expect(userPrompt).toContain("The user's input is: 'camera flies over snowy hills'");
    expect(userPrompt).toContain('FINAL REMINDER');
  });
});
