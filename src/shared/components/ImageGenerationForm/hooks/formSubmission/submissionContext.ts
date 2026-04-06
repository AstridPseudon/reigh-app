import type { MutableRefObject } from 'react';
import type { ActiveLora } from '@/domains/lora/types/lora';
import type { FormStateSnapshot, FormSubmissionFormState, FormSubmissionPromptConfig } from './types';

export interface SubmissionRuntimeContext {
  prompts: FormSubmissionFormState['prompts'];
  promptMultiplier: FormSubmissionFormState['promptMultiplier'];
  imagesPerPrompt: FormSubmissionFormState['imagesPerPrompt'];
  actionablePromptsCount: FormSubmissionFormState['actionablePromptsCount'];
  styleReferenceImageGeneration: FormSubmissionPromptConfig['styleReferenceImageGeneration'];
  generationSourceRef: FormSubmissionPromptConfig['generationSourceRef'];
  selectedTextModelRef: FormSubmissionPromptConfig['selectedTextModelRef'];
  selectedLorasRef: MutableRefObject<ActiveLora[]>;
  formStateRef: MutableRefObject<FormStateSnapshot | undefined>;
}

export function buildSubmissionRuntimeContext(
  props: Pick<FormSubmissionFormState, 'prompts' | 'promptMultiplier' | 'imagesPerPrompt' | 'actionablePromptsCount'>
    & Pick<FormSubmissionPromptConfig, 'styleReferenceImageGeneration' | 'generationSourceRef' | 'selectedTextModelRef'>
    & { selectedLorasRef: MutableRefObject<ActiveLora[]> },
  formStateRef: MutableRefObject<FormStateSnapshot | undefined>,
): SubmissionRuntimeContext {
  return {
    prompts: props.prompts,
    promptMultiplier: props.promptMultiplier,
    imagesPerPrompt: props.imagesPerPrompt,
    actionablePromptsCount: props.actionablePromptsCount,
    styleReferenceImageGeneration: props.styleReferenceImageGeneration,
    generationSourceRef: props.generationSourceRef,
    selectedTextModelRef: props.selectedTextModelRef,
    selectedLorasRef: props.selectedLorasRef,
    formStateRef,
  };
}
