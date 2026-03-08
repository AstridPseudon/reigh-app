import type { MutableRefObject } from 'react';
import type { FormStateSnapshot, FormSubmissionFormState, FormSubmissionPromptConfig } from './types';

export interface SubmissionRuntimeContext {
  prompts: FormSubmissionFormState['prompts'];
  promptMultiplier: FormSubmissionFormState['promptMultiplier'];
  imagesPerPrompt: FormSubmissionFormState['imagesPerPrompt'];
  actionablePromptsCount: FormSubmissionFormState['actionablePromptsCount'];
  styleReferenceImageGeneration: FormSubmissionPromptConfig['styleReferenceImageGeneration'];
  generationSourceRef: FormSubmissionPromptConfig['generationSourceRef'];
  selectedTextModelRef: FormSubmissionPromptConfig['selectedTextModelRef'];
  formStateRef: MutableRefObject<FormStateSnapshot | undefined>;
}

export function buildSubmissionRuntimeContext(
  props: Pick<FormSubmissionFormState, 'prompts' | 'promptMultiplier' | 'imagesPerPrompt' | 'actionablePromptsCount'>
    & Pick<FormSubmissionPromptConfig, 'styleReferenceImageGeneration' | 'generationSourceRef' | 'selectedTextModelRef'>,
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
    formStateRef,
  };
}
