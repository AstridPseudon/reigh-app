import {
  findChildGenerationIdByOrder,
  findChildGenerationIdByPair,
  loadShotGenerationMetadata,
  updateShotGenerationMetadata,
} from '@/integrations/supabase/repositories/segmentGenerationPersistenceRepository';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { ensureShotParentGenerationId } from './shotParentGeneration';

interface ResolveSegmentGenerationRouteInput {
  projectId: string;
  shotId?: string;
  parentGenerationId?: string;
  childGenerationId?: string;
  pairShotGenerationId?: string;
  segmentIndex?: number;
  context: string;
}

interface SegmentGenerationRoute {
  parentGenerationId: string;
  childGenerationId?: string;
}

interface PersistSegmentEnhancedPromptInput {
  pairShotGenerationId?: string;
  enhancedPrompt: string;
  promptToEnhance: string;
  basePrompt: string;
  context: string;
}

export async function resolveSegmentGenerationRoute(
  input: ResolveSegmentGenerationRouteInput,
): Promise<SegmentGenerationRoute> {
  const parentGenerationId = await ensureShotParentGenerationId({
    projectId: input.projectId,
    shotId: input.shotId,
    parentGenerationId: input.parentGenerationId,
    context: input.context,
  });

  if (input.childGenerationId) {
    return {
      parentGenerationId,
      childGenerationId: input.childGenerationId,
    };
  }

  let childGenerationId: string | undefined;
  if (input.pairShotGenerationId) {
    childGenerationId = await findChildGenerationIdByPair(
      parentGenerationId,
      input.pairShotGenerationId,
    );
  }

  if (!childGenerationId && typeof input.segmentIndex === 'number' && !input.pairShotGenerationId) {
    childGenerationId = await findChildGenerationIdByOrder(
      parentGenerationId,
      input.segmentIndex,
    );
  }

  return {
    parentGenerationId,
    childGenerationId,
  };
}

export async function persistSegmentEnhancedPrompt(
  input: PersistSegmentEnhancedPromptInput,
): Promise<boolean> {
  if (!input.pairShotGenerationId || input.enhancedPrompt === input.promptToEnhance) {
    return false;
  }

  try {
    const currentMetadata = await loadShotGenerationMetadata(input.pairShotGenerationId);
    await updateShotGenerationMetadata(input.pairShotGenerationId, {
      ...currentMetadata,
      enhanced_prompt: input.enhancedPrompt,
      base_prompt_for_enhancement: input.basePrompt,
    });
  } catch (error) {
    const context = error instanceof Error && error.message.includes('load segment metadata')
      ? `${input.context}.fetchMetadata`
      : `${input.context}.saveEnhancedPrompt`;
    normalizeAndPresentError(error, {
      context,
      showToast: false,
    });
    throw error;
  }

  return true;
}
