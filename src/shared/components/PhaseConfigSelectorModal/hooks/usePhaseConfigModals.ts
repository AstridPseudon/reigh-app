import { useCallback, useState } from 'react';

export interface PhaseConfigModals {
  activePhaseForLoraSelection: number | null;
  isLoraModalOpen: boolean;
  openLoraModal: (phaseIdx: number) => void;
  closeLoraModal: () => void;
  isPresetModalOpen: boolean;
  presetModalTab: 'browse' | 'add-new';
  modalIntent: 'load' | 'overwrite';
  openPresetModal: (intent: 'load' | 'overwrite', tab: 'browse' | 'add-new') => void;
  closePresetModal: () => void;
  focusedLoraInput: string | null;
  setFocusedLoraInput: (id: string | null) => void;
}

export function usePhaseConfigModals(): PhaseConfigModals {
  const [activePhaseForLoraSelection, setActivePhaseForLoraSelection] = useState<number | null>(null);
  const [isLoraModalOpen, setIsLoraModalOpen] = useState(false);
  const [focusedLoraInput, setFocusedLoraInput] = useState<string | null>(null);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [presetModalTab, setPresetModalTab] = useState<'browse' | 'add-new'>('browse');
  const [modalIntent, setModalIntent] = useState<'load' | 'overwrite'>('load');

  const openLoraModal = useCallback((phaseIdx: number) => {
    setActivePhaseForLoraSelection(phaseIdx);
    setIsLoraModalOpen(true);
  }, []);

  const closeLoraModal = useCallback(() => {
    setIsLoraModalOpen(false);
    setActivePhaseForLoraSelection(null);
  }, []);

  const openPresetModal = useCallback((intent: 'load' | 'overwrite', tab: 'browse' | 'add-new') => {
    setModalIntent(intent);
    setPresetModalTab(tab);
    setIsPresetModalOpen(true);
  }, []);

  const closePresetModal = useCallback(() => {
    setIsPresetModalOpen(false);
  }, []);

  return {
    activePhaseForLoraSelection,
    isLoraModalOpen,
    openLoraModal,
    closeLoraModal,
    isPresetModalOpen,
    presetModalTab,
    modalIntent,
    openPresetModal,
    closePresetModal,
    focusedLoraInput,
    setFocusedLoraInput,
  };
}
