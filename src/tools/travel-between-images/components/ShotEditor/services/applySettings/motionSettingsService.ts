import type { ApplyContext, ApplyResult, ExtractedSettings } from './types';

export const applyTextPromptAddons = (
  settings: ExtractedSettings,
  context: ApplyContext,
): ApplyResult => {
  // Apply text before prompts
  if (settings.textBeforePrompts !== undefined && context.onTextBeforePromptsChange) {
    context.onTextBeforePromptsChange(settings.textBeforePrompts);
  }

  // Apply text after prompts
  if (settings.textAfterPrompts !== undefined && context.onTextAfterPromptsChange) {
    context.onTextAfterPromptsChange(settings.textAfterPrompts);
  }

  return { success: true, settingName: 'textAddons' };
};

export const applyMotionSettings = (
  settings: ExtractedSettings,
  context: ApplyContext,
): ApplyResult => {
  // Only apply if NOT in advanced mode
  if (settings.amountOfMotion !== undefined && !settings.advancedMode && context.onAmountOfMotionChange) {
    context.onAmountOfMotionChange(settings.amountOfMotion * 100);
  }

  return { success: true, settingName: 'motion' };
};
