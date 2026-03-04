import { inheritSettingsForNewShot } from '@/shared/lib/shotSettingsInheritance';
import { dispatchAppEvent } from '@/shared/lib/typedEvents';
import type { PostCreationEffectsInput } from './shotCreationTypes';

export function dispatchShotSkeletonEvent(imageCount: number): void {
  dispatchAppEvent('shot-pending-create', { imageCount });
}

export function clearShotSkeletonEvent(): void {
  dispatchAppEvent('shot-pending-create-clear');
}

export function applyShotCreationPostEffects({
  result,
  options,
  selectedProjectId,
  shots,
  setLastAffectedShotId,
  setLastCreatedShot,
}: PostCreationEffectsInput): void {
  const { inheritSettings = true, updateLastAffected = true } = options;

  if (updateLastAffected) {
    setLastAffectedShotId(result.shotId);
  }

  if (inheritSettings && selectedProjectId) {
    inheritSettingsForNewShot({
      newShotId: result.shotId,
      projectId: selectedProjectId,
      shots: (shots || []) as Array<{
        id: string;
        name: string;
        created_at?: string;
        settings?: Record<string, unknown>;
      }>,
    });
  }

  setLastCreatedShot({ id: result.shotId, name: result.shotName });
}
