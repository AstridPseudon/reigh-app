import { useEditingController } from './useEditingController';
import { useOutputController } from './useOutputController';
import type { ShotEditorState } from '../state/types';
import type { ShotEditorActions } from '../state/useShotEditorState';
import type { GenerationRow, Shot } from '@/domains/generation/types';

interface UseShotEditorMediaAndOutputControllersParams {
  selectedProjectId: string;
  selectedShotId: string;
  selectedShot: Shot | null;
  projectId: string;
  timelineImages: GenerationRow[];
  effectiveAspectRatio?: string;
  swapButtonRef: React.RefObject<HTMLButtonElement>;
  onUpdateShotName?: (name: string) => void;
  state: Pick<ShotEditorState, 'isEditingName' | 'editingName'>;
  actions: ShotEditorActions;
  generationTypeMode: 'i2v' | 'vace';
  setGenerationTypeMode: (mode: 'i2v' | 'vace') => void;
}

export function useShotEditorMediaAndOutputControllers({
  selectedProjectId,
  selectedShotId,
  selectedShot,
  projectId,
  timelineImages,
  effectiveAspectRatio,
  swapButtonRef,
  onUpdateShotName,
  state,
  actions,
  generationTypeMode,
  setGenerationTypeMode,
}: UseShotEditorMediaAndOutputControllersParams) {
  const output = useOutputController({
    selectedProjectId,
    selectedShotId,
    selectedShot,
    projectId,
    timelineImages,
  });

  const editing = useEditingController({
    core: {
      selectedShotId,
      projectId,
      selectedProjectId,
      selectedShot,
      effectiveAspectRatio,
      swapButtonRef,
    },
    nameEditing: {
      onUpdateShotName,
      state,
      actions,
    },
    generationType: {
      generationTypeMode,
      setGenerationTypeMode,
    },
    joinInputs: {
      joinSegmentSlots: output.joinSegmentSlots,
      joinSelectedParent: output.joinSelectedParent,
    },
  });

  return {
    output,
    editing,
  };
}
