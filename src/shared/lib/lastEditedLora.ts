import type { ActiveLora } from '@/domains/lora/types/lora';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import { STORAGE_KEYS } from '@/shared/lib/storage/storageKeys';
import { readLocalStorageItem, writeLocalStorageItem } from '@/shared/lib/storage/localStorageSafe';
import { TOOL_IDS } from '@/shared/lib/tooling/toolIds';
import { toObjectRecord } from '@/shared/lib/jsonRecord';
import { fetchToolSettingsSupabase, updateToolSettingsSupabase } from '@/shared/settings';

export type LastEditedLoraValue = ActiveLora | null | undefined;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeLastEditedLora(value: unknown): LastEditedLoraValue {
  if (value === null) {
    return null;
  }

  const record = toObjectRecord(value);
  if (!record) {
    return undefined;
  }

  const id = asString(record.id);
  const name = asString(record.name);
  const path = asString(record.path);
  const strength = asNumber(record.strength);
  if (!id || !name || !path || strength === undefined) {
    return undefined;
  }

  return {
    id,
    name,
    path,
    strength,
    ...(asString(record.previewImageUrl) ? { previewImageUrl: asString(record.previewImageUrl) } : {}),
    ...(asString(record.trigger_word) ? { trigger_word: asString(record.trigger_word) } : {}),
    ...(asString(record.lowNoisePath) ? { lowNoisePath: asString(record.lowNoisePath) } : {}),
    ...(asBoolean(record.isMultiStage) !== undefined ? { isMultiStage: asBoolean(record.isMultiStage) } : {}),
  };
}

export async function writeLastEditedLora(
  projectId: string | null | undefined,
  lora: ActiveLora | null,
): Promise<void> {
  if (!projectId) {
    return;
  }

  writeLocalStorageItem(
    STORAGE_KEYS.LAST_EDITED_LORA(projectId),
    JSON.stringify(lora),
    { context: 'lastEditedLora.writeLocalStorage', fallback: undefined },
  );

  await updateToolSettingsSupabase({
    scope: 'project',
    id: projectId,
    toolId: TOOL_IDS.TRAVEL_BETWEEN_IMAGES,
    patch: { lastEditedLora: lora },
  });
}

export function readLastEditedLoraFromLocalStorage(
  projectId: string | null | undefined,
): LastEditedLoraValue {
  if (!projectId) {
    return undefined;
  }

  const rawValue = readLocalStorageItem(
    STORAGE_KEYS.LAST_EDITED_LORA(projectId),
    { context: 'lastEditedLora.readLocalStorage', fallback: null },
  );
  if (rawValue === null) {
    return undefined;
  }

  try {
    return normalizeLastEditedLora(JSON.parse(rawValue));
  } catch (error) {
    normalizeAndPresentError(error, {
      context: 'lastEditedLora.parseLocalStorage',
      showToast: false,
      logData: { projectId },
    });
    return undefined;
  }
}

export async function readLastEditedLoraFromProject(
  projectId: string | null | undefined,
): Promise<LastEditedLoraValue> {
  if (!projectId) {
    return undefined;
  }

  try {
    const { settings } = await fetchToolSettingsSupabase<Record<string, unknown>>(
      TOOL_IDS.TRAVEL_BETWEEN_IMAGES,
      { projectId },
    );
    const travelSettings = toObjectRecord(settings);
    return normalizeLastEditedLora(travelSettings?.lastEditedLora);
  } catch (error) {
    normalizeAndPresentError(error, {
      context: 'lastEditedLora.readFromProject',
      showToast: false,
      logData: { projectId },
    });
    return undefined;
  }
}
