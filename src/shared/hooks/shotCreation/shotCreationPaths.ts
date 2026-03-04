import type { ShotCreationResult } from './shotCreationTypes';
import type {
  CreateEmptyShotPathInput,
  CreateShotWithFilesPathInput,
  CreateShotWithGenerationPathInput,
} from './shotCreationTypes';
import { applyAtomicShotCacheUpdate } from './shotCacheUpdate';

export async function createShotWithGenerationPath(
  input: CreateShotWithGenerationPathInput,
): Promise<ShotCreationResult> {
  const {
    selectedProjectId,
    shotName,
    generationId,
    generationPreview,
    shots,
    queryClient,
    createShotWithImage,
  } = input;

  const rpcResult = await createShotWithImage({
    projectId: selectedProjectId,
    shotName,
    generationId,
  });

  applyAtomicShotCacheUpdate({
    selectedProjectId,
    shotId: rpcResult.shotId,
    shotName: rpcResult.shotName || shotName,
    shotGenerationId: rpcResult.shotGenerationId,
    generationId,
    generationPreview,
    shots,
    queryClient,
  });

  return {
    shotId: rpcResult.shotId,
    shotName: rpcResult.shotName,
    generationIds: [generationId],
  };
}

export async function createShotWithFilesPath(
  input: CreateShotWithFilesPathInput,
): Promise<ShotCreationResult> {
  const {
    selectedProjectId,
    shotName,
    files,
    aspectRatio,
    shots,
    onProgress,
    createShot,
    uploadToShot,
  } = input;

  const created = await createShot({
    name: shotName,
    projectId: selectedProjectId,
    aspectRatio: aspectRatio || undefined,
    shouldSelectAfterCreation: false,
  });

  const newShotId = created?.shot?.id;
  if (!newShotId) {
    throw new Error('Shot creation failed - no ID returned');
  }

  const uploadResult = await uploadToShot({
    imageFiles: files,
    targetShotId: newShotId,
    currentProjectQueryKey: selectedProjectId,
    currentShotCount: shots?.length ?? 0,
    onProgress,
  });

  if (!uploadResult?.shotId) {
    throw new Error('File upload failed - no images processed');
  }

  return {
    shotId: newShotId,
    shotName: created.shot?.name || shotName,
    shot: created.shot,
    generationIds: uploadResult.generationIds,
  };
}

export async function createEmptyShotPath(
  input: CreateEmptyShotPathInput,
): Promise<ShotCreationResult> {
  const { selectedProjectId, shotName, aspectRatio, createShot } = input;

  const createResult = await createShot({
    name: shotName,
    projectId: selectedProjectId,
    aspectRatio: aspectRatio || undefined,
    shouldSelectAfterCreation: false,
  });

  if (!createResult?.shot?.id) {
    throw new Error('Shot creation failed - no ID returned');
  }

  return {
    shotId: createResult.shot.id,
    shotName: createResult.shot.name || shotName,
    shot: createResult.shot,
  };
}
