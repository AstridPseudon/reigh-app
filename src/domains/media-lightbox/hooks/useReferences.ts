import { useState } from 'react';
import { toast } from '@/shared/components/ui/runtime/sonner';
import { GenerationRow } from '@/domains/generation/types';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { useCreateResource, type StyleReferenceMetadata } from '@/features/resources/hooks/useResources';
import { useToolSettings } from '@/shared/hooks/settings/useToolSettings';
import { SETTINGS_IDS } from '@/shared/lib/settingsIds';
import type { ReferenceImage } from '@/shared/types/referenceImage';
import { getGenerationId } from '@/shared/lib/media/mediaTypeHelpers';
import { buildStyleReferenceMetadataFromGeneration } from '@/shared/components/ImageGenerationForm/hooks/referenceUpload/referenceDomainService';

/** Settings shape for project-image-settings tool */
interface ProjectImageSettingsForReferences {
  references?: ReferenceImage[];
  selectedReferenceIdByShot?: Record<string, string | null>;
  [key: string]: unknown;
}

interface UseReferencesProps {
  media: GenerationRow;
  selectedProjectId: string | null;
  selectedShotId?: string;
  isVideo: boolean;
}

interface UseReferencesReturn {
  isAddingToReferences: boolean;
  addToReferencesSuccess: boolean;
  handleAddToReferences: () => Promise<void>;
}

function buildReferenceMetadata(
  generation: GenerationRow,
  referenceCount: number,
): StyleReferenceMetadata {
  return buildStyleReferenceMetadataFromGeneration(generation, referenceCount);
}

function resolveEffectiveShotId(
  selectedShotId: string | undefined,
  selectedReferenceIdByShot: Record<string, string | null>
): string {
  if (selectedShotId) {
    return selectedShotId;
  }

  const existingShots = Object.keys(selectedReferenceIdByShot);
  if (existingShots.length > 0) {
    return existingShots[0];
  }

  return 'shot-1';
}

function createReferenceUpdatePayload(input: {
  references: ReferenceImage[];
  selectedReferenceIdByShot: Record<string, string | null>;
  selectedShotId: string;
  newPointer: ReferenceImage;
}): Pick<ProjectImageSettingsForReferences, 'references' | 'selectedReferenceIdByShot'> {
  return {
    references: [...input.references, input.newPointer],
    selectedReferenceIdByShot: {
      ...input.selectedReferenceIdByShot,
      [input.selectedShotId]: input.newPointer.id,
      none: input.newPointer.id,
    },
  };
}

/**
 * Hook for managing adding images to project references
 * Handles image processing, uploading, and adding to project settings
 */
export const useReferences = ({
  media,
  selectedProjectId,
  selectedShotId,
  isVideo,
}: UseReferencesProps): UseReferencesReturn => {
  const [isAddingToReferences, setIsAddingToReferences] = useState(false);
  const [addToReferencesSuccess, setAddToReferencesSuccess] = useState(false);
  const createResource = useCreateResource();

  const {
    settings: projectImageSettings,
    update: updateProjectImageSettings,
  } = useToolSettings<ProjectImageSettingsForReferences>(SETTINGS_IDS.PROJECT_IMAGE_SETTINGS, {
    projectId: selectedProjectId ?? undefined,
    enabled: !!selectedProjectId,
  });

  const handleAddToReferences = async () => {
    if (!selectedProjectId || isVideo) {
      toast.error('Cannot add videos to references');
      return;
    }

    setIsAddingToReferences(true);
    try {
      const references = projectImageSettings?.references || [];
      const selectedReferenceIdByShot = projectImageSettings?.selectedReferenceIdByShot || {};
      const generationId = getGenerationId(media);

      if (!generationId) {
        throw new Error('Could not resolve a generation ID for this media item');
      }

      const metadata = buildReferenceMetadata(media, references.length);

      const resource = await createResource.mutateAsync({
        type: 'style-reference',
        metadata,
        generation_id: generationId,
      });

      const newPointer: ReferenceImage = {
        id: crypto.randomUUID(),
        resourceId: resource.id,
      };

      const effectiveShotId = resolveEffectiveShotId(selectedShotId, selectedReferenceIdByShot);
      const updatePayload = createReferenceUpdatePayload({
        references,
        selectedReferenceIdByShot,
        selectedShotId: effectiveShotId,
        newPointer,
      });

      await updateProjectImageSettings('project', updatePayload);
      setAddToReferencesSuccess(true);
      setTimeout(() => {
        setAddToReferencesSuccess(false);
      }, 2000);
    } catch (error) {
      normalizeAndPresentError(error, { context: 'useReferences', toastTitle: 'Failed to add to references' });
    } finally {
      setIsAddingToReferences(false);
    }
  };

  return {
    isAddingToReferences,
    addToReferencesSuccess,
    handleAddToReferences,
  };
};
