import { useState, useCallback } from 'react';
import { invokeWithTimeout } from '@/shared/lib/invokeWithTimeout';
import { handleError } from '@/shared/lib/errorHandling/handleError';
import {
  AIPromptItem,
  GeneratePromptsParams,
  EditPromptParams,
  EditPromptResult,
} from '@/types/ai';

interface UseAIInteractionServiceOptions {
  generatePromptId: () => string; // Function to generate unique IDs for new prompts
}

export const useAIInteractionService = ({
  generatePromptId,
}: UseAIInteractionServiceOptions) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const generateSummary = useCallback(
    async (promptText: string): Promise<string | null> => {
      setIsSummarizing(true);

      try {
        const data = await invokeWithTimeout<{ summary?: string }>('ai-prompt', {
          body: {
            task: 'generate_summary',
            promptText },
          timeoutMs: 20000,
        });

        return data?.summary || null;
      } catch (error) {
        handleError(error, { context: 'useAIInteractionService', showToast: false });
        return null;
      } finally {
        setIsSummarizing(false);
      }
    },
    []
  );

  const generatePrompts = useCallback(
    async (params: GeneratePromptsParams): Promise<AIPromptItem[]> => {
      setIsGenerating(true);

      try {
        const data = await invokeWithTimeout<{ prompts?: string[] }>('ai-prompt', {
          body: {
            task: 'generate_prompts',
            overallPromptText: params.overallPromptText,
            rulesToRememberText: params.rulesToRememberText,
            numberToGenerate: params.numberToGenerate,
            existingPrompts: params.existingPrompts ?? [],
            temperature: params.temperature || 0.8,
          },
          timeoutMs: 20000,
        });

        const generatedTexts: string[] = data?.prompts ?? [];

        const newPrompts: AIPromptItem[] = [];
        for (const text of generatedTexts) {
          const newId = generatePromptId();
          let shortText = '';

          // Optionally generate summaries if requested.
          if (params.addSummaryForNewPrompts) {
            const summary = await generateSummary(text);
            shortText = summary || '';
          }

          newPrompts.push({
            id: newId,
            text: text.trim(),
            shortText,
            hidden: false,
          });
        }
        return newPrompts;
      } catch (err) {
        handleError(err, { context: 'useAIInteractionService', showToast: false });
        return [];
      } finally {
        setIsGenerating(false);
      }
    },
    [generatePromptId, generateSummary]
  );

  const editPromptWithAI = useCallback(
    async (params: EditPromptParams): Promise<EditPromptResult> => {
      setIsEditing(true);
      
      try {
        const result = await invokeWithTimeout<{ newText?: string }>('ai-prompt', {
          body: {
            task: 'edit_prompt',
            originalPromptText: params.originalPromptText,
            editInstructions: params.editInstructions,
            modelType: params.modelType === 'smart' ? 'smart' : 'fast',
          },
          timeoutMs: 20000,
        });
        const newText = result?.newText || params.originalPromptText;
         
        return { success: true, newText: newText || params.originalPromptText };
      } catch (error) {
        handleError(error, { context: 'useAIInteractionService', showToast: false });
        return { success: false, newText: params.originalPromptText };
      } finally {
        setIsEditing(false);
      }
    },
    []
  );

  return {
    generatePrompts,
    editPromptWithAI,
    generateSummary,
    isGenerating,
    isEditing,
    isSummarizing,
    isLoading: isGenerating || isEditing || isSummarizing,
  };
}; 
