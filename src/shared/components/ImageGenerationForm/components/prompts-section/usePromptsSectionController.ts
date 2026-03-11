import React, { useCallback } from 'react';
import { useIsMobile } from '@/shared/hooks/mobile';
import { PromptMode } from '../../types';
import {
  useFormCoreContext,
  useFormPromptsContext,
  useFormUIContext,
} from '../../ImageGenerationFormContext';

interface PromptsSectionController {
  actionablePromptsCount: number;
  afterEachPromptText: string;
  beforeEachPromptText: string;
  handleResetPromptsToSingleBlank: () => void;
  isGenerating: boolean;
  isMobile: boolean;
  masterPromptText: string;
  normalizedPromptMode: PromptMode;
  prompts: Array<{ id: string; fullPrompt: string; shortPrompt?: string; active?: boolean }>;
  ready: boolean;
  onAfterEachPromptTextChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBeforeEachPromptTextChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onClearAfterEachPromptText: () => void;
  onClearBeforeEachPromptText: () => void;
  onClearMasterPromptText: () => void;
  onMasterPromptTextChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onMasterVoiceResult: (result: { prompt?: string; transcription?: string }) => void;
  onOpenMagicPrompt: () => void;
  onOpenPromptModal: () => void;
  onAfterVoiceResult: (result: { prompt?: string; transcription?: string }) => void;
  onBeforeVoiceResult: (result: { prompt?: string; transcription?: string }) => void;
}

export const usePromptsSectionController = (): PromptsSectionController => {
  const { uiActions } = useFormUIContext();
  const { isGenerating, ready } = useFormCoreContext();
  const {
    prompts,
    masterPromptText,
    effectivePromptMode: promptMode,
    actionablePromptsCount,
    currentBeforePromptText: beforeEachPromptText,
    currentAfterPromptText: afterEachPromptText,
    setMasterPromptText,
    setCurrentBeforePromptText,
    setCurrentAfterPromptText,
    handleResetPromptsToSingleBlank,
    markAsInteracted,
  } = useFormPromptsContext();

  const isMobile = useIsMobile();

  const onMasterPromptTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMasterPromptText(event.target.value);
  }, [setMasterPromptText]);

  const onBeforeEachPromptTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentBeforePromptText(event.target.value);
  }, [setCurrentBeforePromptText]);

  const onAfterEachPromptTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentAfterPromptText(event.target.value);
  }, [setCurrentAfterPromptText]);

  const onClearMasterPromptText = useCallback(() => {
    markAsInteracted();
    setMasterPromptText('');
  }, [markAsInteracted, setMasterPromptText]);

  const onClearBeforeEachPromptText = useCallback(() => {
    markAsInteracted();
    setCurrentBeforePromptText('');
  }, [markAsInteracted, setCurrentBeforePromptText]);

  const onClearAfterEachPromptText = useCallback(() => {
    markAsInteracted();
    setCurrentAfterPromptText('');
  }, [markAsInteracted, setCurrentAfterPromptText]);

  const onOpenPromptModal = useCallback(() => {
    uiActions.setPromptModalOpen(true);
  }, [uiActions]);

  const onOpenMagicPrompt = useCallback(() => {
    uiActions.openMagicPrompt();
  }, [uiActions]);

  const onMasterVoiceResult = useCallback((result: { prompt?: string; transcription?: string }) => {
    const text = result.prompt || result.transcription || '';
    onMasterPromptTextChange({ target: { value: text } } as React.ChangeEvent<HTMLTextAreaElement>);
  }, [onMasterPromptTextChange]);

  const onBeforeVoiceResult = useCallback((result: { prompt?: string; transcription?: string }) => {
    const text = result.prompt || result.transcription || '';
    onBeforeEachPromptTextChange({ target: { value: text } } as React.ChangeEvent<HTMLTextAreaElement>);
  }, [onBeforeEachPromptTextChange]);

  const onAfterVoiceResult = useCallback((result: { prompt?: string; transcription?: string }) => {
    const text = result.prompt || result.transcription || '';
    onAfterEachPromptTextChange({ target: { value: text } } as React.ChangeEvent<HTMLTextAreaElement>);
  }, [onAfterEachPromptTextChange]);

  const normalizedPromptMode: PromptMode =
    (promptMode === 'automated' || promptMode === 'managed') ? promptMode : 'automated';

  return {
    actionablePromptsCount,
    afterEachPromptText,
    beforeEachPromptText,
    handleResetPromptsToSingleBlank,
    isGenerating,
    isMobile,
    masterPromptText,
    normalizedPromptMode,
    prompts,
    ready,
    onAfterEachPromptTextChange,
    onAfterVoiceResult,
    onBeforeEachPromptTextChange,
    onBeforeVoiceResult,
    onClearAfterEachPromptText,
    onClearBeforeEachPromptText,
    onClearMasterPromptText,
    onMasterPromptTextChange,
    onMasterVoiceResult,
    onOpenMagicPrompt,
    onOpenPromptModal,
  };
};
