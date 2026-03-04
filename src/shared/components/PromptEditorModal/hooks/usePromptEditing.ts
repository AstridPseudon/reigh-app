import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import type { PromptEntry } from '@/shared/components/ImageGenerationForm';
import type { GeneratePromptsParams } from '@/types/ai';
import type { BulkEditParams as BEC_BulkEditParams } from '@/shared/components/PromptEditorModal/BulkEditControls';

interface UsePromptEditingParams {
  isOpen: boolean;
  initialPrompts: PromptEntry[];
  onSave: (updatedPrompts: PromptEntry[]) => void;
  onClose: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  selectedProjectId: string | null;
  generatePromptId: () => string;
  onGenerateAndQueue?: (prompts: PromptEntry[]) => void;
  aiGeneratePrompts: (params: GeneratePromptsParams) => Promise<Array<{ id: string; text: string; shortText?: string }>>;
  aiEditPrompt: (params: { originalPromptText: string; editInstructions: string; modelType?: string }) => Promise<{ success: boolean; newText?: string; newShortText?: string }>;
  aiGenerateSummary: (promptText: string) => Promise<string | null | undefined>;
}

export function usePromptEditing({
  isOpen,
  initialPrompts,
  onSave,
  onClose,
  scrollRef,
  selectedProjectId,
  generatePromptId,
  onGenerateAndQueue,
  aiGeneratePrompts,
  aiEditPrompt,
  aiGenerateSummary,
}: UsePromptEditingParams) {
  const [internalPrompts, setInternalPrompts] = useState<PromptEntry[]>(() =>
    initialPrompts.map((prompt) => ({ ...prompt })),
  );

  const internalPromptsRef = useRef<PromptEntry[]>([]);
  useEffect(() => {
    internalPromptsRef.current = internalPrompts;
  }, [internalPrompts]);

  const currentPromptsSignature = useMemo(() => JSON.stringify(internalPrompts), [internalPrompts]);
  const currentSignatureRef = useRef<string>(currentPromptsSignature);
  useEffect(() => {
    currentSignatureRef.current = currentPromptsSignature;
  }, [currentPromptsSignature]);
  const lastSavedSignatureRef = useRef<string>('');

  useLayoutEffect(() => {
    if (isOpen) {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
      setInternalPrompts(initialPrompts.map((prompt) => ({ ...prompt })));
      lastSavedSignatureRef.current = JSON.stringify(initialPrompts);
    }
  }, [isOpen, selectedProjectId, initialPrompts, scrollRef]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const intervalId = setInterval(() => {
      const hasChanges = lastSavedSignatureRef.current !== currentSignatureRef.current;
      if (hasChanges) {
        try {
          onSave(internalPromptsRef.current);
          lastSavedSignatureRef.current = currentSignatureRef.current;
        } catch (error) {
          normalizeAndPresentError(error, { context: 'PromptEditorModal', showToast: false });
        }
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isOpen, onSave]);

  const handleFinalSaveAndClose = useCallback(() => {
    onSave(internalPrompts);
    lastSavedSignatureRef.current = currentSignatureRef.current;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    onClose();
  }, [internalPrompts, onSave, onClose, scrollRef]);

  const handleInternalUpdatePrompt = useCallback((id: string, updates: Partial<Omit<PromptEntry, 'id'>>) => {
    setInternalPrompts((currentPrompts) =>
      currentPrompts.map((prompt) => (prompt.id === id ? { ...prompt, ...updates } : prompt)),
    );
  }, []);

  const handlePromptFieldUpdate = useCallback((
    id: string,
    field: 'fullPrompt' | 'shortPrompt',
    value: string,
  ) => {
    const updatePayload: Partial<Omit<PromptEntry, 'id'>> = {};
    if (field === 'fullPrompt') {
      updatePayload.fullPrompt = value;
    }
    if (field === 'shortPrompt') {
      updatePayload.shortPrompt = value;
    }
    handleInternalUpdatePrompt(id, updatePayload);
  }, [handleInternalUpdatePrompt]);

  const handleInternalRemovePrompt = useCallback((id: string) => {
    setInternalPrompts((currentPrompts) => currentPrompts.filter((prompt) => prompt.id !== id));
  }, []);

  const handleInternalAddBlankPrompt = useCallback(() => {
    const newPromptEntry: PromptEntry = { id: generatePromptId(), fullPrompt: '', shortPrompt: '' };
    setInternalPrompts((currentPrompts) => [...currentPrompts, newPromptEntry]);

    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 100);
  }, [generatePromptId, scrollRef]);

  const handleRemoveAllPrompts = useCallback(() => {
    const emptyPrompt: PromptEntry = { id: generatePromptId(), fullPrompt: '', shortPrompt: '' };
    setInternalPrompts([emptyPrompt]);
  }, [generatePromptId]);

  const handleGenerateAndAddPrompts = useCallback(async (params: GeneratePromptsParams) => {
    const summariesInitiallyRequested = params.addSummaryForNewPrompts;
    const rawResults = await aiGeneratePrompts(params);

    const newEntries: PromptEntry[] = rawResults.map((item) => ({
      id: item.id,
      fullPrompt: item.text,
      shortPrompt: item.shortText,
    }));

    const allExistingPromptsAreEmpty = internalPrompts.every(
      (prompt) => !prompt.fullPrompt.trim() && !(prompt.shortPrompt ?? '').trim(),
    );

    const shouldReplace = params.replaceCurrentPrompts || allExistingPromptsAreEmpty;
    setInternalPrompts((currentPrompts) => (shouldReplace ? newEntries : [...currentPrompts, ...newEntries]));

    if (!summariesInitiallyRequested && params.addSummaryForNewPrompts && newEntries.length > 0) {
      for (const entry of newEntries) {
        if (!entry.shortPrompt && entry.fullPrompt) {
          try {
            const summary = await aiGenerateSummary(entry.fullPrompt);
            if (summary) {
              setInternalPrompts((currentPrompts) =>
                currentPrompts.map((prompt) =>
                  prompt.id === entry.id ? { ...prompt, shortPrompt: summary } : prompt,
                ),
              );
            }
          } catch (error) {
            normalizeAndPresentError(error, { context: 'PromptEditorModal', showToast: false });
          }
        }
      }

      setInternalPrompts((currentPrompts) => currentPrompts);
    }
  }, [aiGeneratePrompts, aiGenerateSummary, internalPrompts]);

  const handleGenerateAndQueue = useCallback(async (params: GeneratePromptsParams) => {
    await handleGenerateAndAddPrompts(params);
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (onGenerateAndQueue) {
      onGenerateAndQueue(internalPromptsRef.current);
    }
  }, [handleGenerateAndAddPrompts, onGenerateAndQueue]);

  const handleBulkEditPrompts = useCallback(async (params: BEC_BulkEditParams) => {
    if (internalPrompts.length === 0) {
      return;
    }

    const promptsToUpdate = internalPrompts.map((prompt) => ({ id: prompt.id, text: prompt.fullPrompt }));
    const editRequests = promptsToUpdate.map((prompt) => ({
      originalPromptText: prompt.text,
      editInstructions: params.editInstructions,
      modelType: params.modelType,
    }));

    const originalPromptIds = promptsToUpdate.map((prompt) => prompt.id);

    for (let index = 0; index < editRequests.length; index += 1) {
      const request = editRequests[index];
      const promptIdToUpdate = originalPromptIds[index];

      try {
        const result = await aiEditPrompt(request);
        if (result.success && result.newText) {
          setInternalPrompts((currentPrompts) =>
            currentPrompts.map((prompt) =>
              prompt.id === promptIdToUpdate
                ? { ...prompt, fullPrompt: result.newText!, shortPrompt: result.newShortText || '' }
                : prompt,
            ),
          );
        }
      } catch (error) {
        normalizeAndPresentError(error, {
          context: 'PromptEditorModal',
          toastTitle: `Error editing prompt ${promptIdToUpdate.substring(0, 8)}...`,
        });
      }
    }
  }, [aiEditPrompt, internalPrompts]);

  return {
    internalPrompts,
    handleFinalSaveAndClose,
    handlePromptFieldUpdate,
    handleInternalRemovePrompt,
    handleInternalAddBlankPrompt,
    handleRemoveAllPrompts,
    handleGenerateAndAddPrompts,
    handleGenerateAndQueue,
    handleBulkEditPrompts,
  };
}
