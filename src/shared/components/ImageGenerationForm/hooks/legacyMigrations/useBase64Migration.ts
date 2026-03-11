import { useEffect } from 'react';
import { dataURLtoFile } from '@/shared/lib/media/fileConversion';
import { uploadImageToStorage } from '@/shared/lib/media/imageUploader';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { getOperationFailureLogData } from '@/shared/lib/operationResult';
import type { LegacyMigrationsInput } from './types';

type Base64MigrationInput = Pick<
  LegacyMigrationsInput,
  'rawStyleReferenceImage' | 'selectedProjectId' | 'updateProjectImageSettings'
>;

// SUNSET: 2026-09-01 — remove after confirming no projects persist base64 styleReferenceImage.
export function useBase64Migration(input: Base64MigrationInput): void {
  const {
    rawStyleReferenceImage,
    selectedProjectId,
    updateProjectImageSettings,
  } = input;

  useEffect(() => {
    const migrateBase64ToUrl = async () => {
      if (
        !rawStyleReferenceImage ||
        !rawStyleReferenceImage.startsWith('data:image/') ||
        !selectedProjectId
      ) {
        return;
      }

      try {
        const fileResult = dataURLtoFile(
          rawStyleReferenceImage,
          `migrated-style-reference-${Date.now()}.png`
        );

        if (!fileResult.ok) {
          normalizeAndPresentError(fileResult.error, {
            context: 'ImageGenerationForm.migrateBase64ToUrl.dataURLtoFile',
            toastTitle: 'Failed to migrate style reference image',
            logData: getOperationFailureLogData(fileResult),
          });
          return;
        }

        const uploadedUrl = await uploadImageToStorage(fileResult.value);

        await updateProjectImageSettings('project', {
          styleReferenceImage: uploadedUrl,
          styleReferenceImageOriginal: uploadedUrl,
        });
      } catch (error) {
        normalizeAndPresentError(error, {
          context: 'ImageGenerationForm.migrateBase64ToUrl',
          toastTitle: 'Failed to migrate style reference image',
        });
      }
    };

    void migrateBase64ToUrl();
  }, [rawStyleReferenceImage, selectedProjectId, updateProjectImageSettings]);
}
