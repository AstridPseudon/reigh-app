import { TOOL_IDS } from '@/shared/lib/tooling/toolIds';
import type { ToolUIDefinition } from '@/shared/lib/tooling/toolManifest';
import { AppEnv, type AppEnvValue } from '@/types/env';

type ToolEligibilityCandidate = Pick<ToolUIDefinition, 'id' | 'environments'>;

interface ToolEligibilityContext {
  currentEnv: AppEnvValue;
  isCloudGenerationEnabled: boolean;
  isLoadingGenerationMethods: boolean;
}

export function isToolEligible(
  tool: ToolEligibilityCandidate | null | undefined,
  ctx: ToolEligibilityContext,
): boolean {
  if (!tool) return false;

  if (tool.id === TOOL_IDS.CHARACTER_ANIMATE) {
    const envCheck = tool.environments.includes(ctx.currentEnv) || ctx.currentEnv === AppEnv.DEV;
    return envCheck && (ctx.isLoadingGenerationMethods || ctx.isCloudGenerationEnabled);
  }

  if (ctx.currentEnv === AppEnv.DEV) return true;

  return tool.environments.includes(ctx.currentEnv);
}
