import { processStyleReferenceForAspectRatioString } from './styleReferenceProcessor';
import { uploadImageToStorage } from './imageUploader';
import { dataURLtoFile } from './fileConversion';
import { generateClientThumbnail, uploadImageWithThumbnail } from '@/shared/media/clientThumbnailGenerator';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { getOperationFailureLogData } from '@/shared/lib/operationResult';
import type { HydratedReferenceImage } from '@/shared/types/referenceHydration';

export interface RecroppedReferenceResult {
  resourceId: string;
  generationId?: string;
  styleReferenceImage: string;
  thumbnailUrl: string;
  updatedAt: string;
}

/**
 * Reprocesses all reference images for a project when dimensions change.
 * Uses the original images as source and regenerates cropped versions.
 * 
  * @param references - Array of reference images to reprocess
  * @param newAspectRatio - New aspect ratio string (e.g., "16:9", "1:1")
  * @param onProgress - Optional callback for progress updates (current, total)
 * @returns Promise with successful recrop results keyed by resourceId
 */
export async function recropAllReferences(
  references: HydratedReferenceImage[],
  newAspectRatio: string,
  onProgress?: (current: number, total: number) => void
): Promise<RecroppedReferenceResult[]> {
  const reprocessed: RecroppedReferenceResult[] = [];
  
  for (let i = 0; i < references.length; i++) {
    const ref = references[i];
    
    // Skip if no original image
    if (!ref.styleReferenceImageOriginal) {
      onProgress?.(i + 1, references.length);
      continue;
    }
    
    try {
      // Fetch the original image
      const response = await fetch(ref.styleReferenceImageOriginal);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      
      // Convert to data URL for processing
      const dataURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
        reader.readAsDataURL(blob);
      });
      
      // Reprocess for new aspect ratio
      const processedDataURL = await processStyleReferenceForAspectRatioString(
        dataURL,
        newAspectRatio
      );
      
      if (!processedDataURL) {
        throw new Error('processStyleReferenceForAspectRatioString returned null');
      }
      
      // Upload new processed version with thumbnail
      const processedFileResult = dataURLtoFile(
        processedDataURL,
        `reference-${ref.id}-${Date.now()}.png`
      );

      if (!processedFileResult.ok) {
        normalizeAndPresentError(processedFileResult.error, {
          context: 'RecropReferences.dataURLtoFile',
          showToast: false,
          logData: getOperationFailureLogData(processedFileResult),
        });
        throw processedFileResult.error;
      }

      const processedFile = processedFileResult.value;

      let newProcessedUrl = '';
      let newThumbnailUrl = '';
      
      try {
        // Generate thumbnail for reprocessed image
        const thumbnailResult = await generateClientThumbnail(processedFile, 300, 0.8);

        // Upload both main image and thumbnail
        const uploadResult = await uploadImageWithThumbnail(processedFile, thumbnailResult.thumbnailBlob);
        newProcessedUrl = uploadResult.imageUrl;
        newThumbnailUrl = uploadResult.thumbnailUrl;
        
      } catch {
        // Fallback to original upload flow without thumbnail
        newProcessedUrl = await uploadImageToStorage(processedFile);
        newThumbnailUrl = newProcessedUrl; // Use main image as fallback
      }
      
      // Update reference with new processed URL and thumbnail (keep original)
      const updatedRef: RecroppedReferenceResult = {
        resourceId: ref.resourceId,
        generationId: ref.generationId,
        styleReferenceImage: newProcessedUrl,
        thumbnailUrl: newThumbnailUrl,
        updatedAt: new Date().toISOString()
      };
      reprocessed.push(updatedRef);
      
      // Report progress
      onProgress?.(i + 1, references.length);
      
    } catch (error) {
      normalizeAndPresentError(error, { context: 'RecropReferences', showToast: false });
      // Still report progress
      onProgress?.(i + 1, references.length);
    }
  }
  
  return reprocessed;
}
