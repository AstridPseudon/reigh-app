import { getSupabaseClient as supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS } from '@/shared/lib/storage/storageKeys';
import { normalizeAndPresentError } from '@/shared/lib/errorHandling/runtimeError';
import type { LastEditedLoraValue } from '@/shared/lib/lastEditedLora';
import { readLastEditedLoraFromLocalStorage, readLastEditedLoraFromProject } from '@/shared/lib/lastEditedLora';
import { SETTINGS_IDS } from '@/shared/lib/settingsIds';
import { TOOL_IDS } from '@/shared/lib/tooling/toolIds';
import { toObjectRecord } from '@/shared/lib/jsonRecord';
import { compareByCreatedAtDesc } from '@/shared/lib/sorting/createdAtSort';

/**
 * Standardized settings inheritance for new shots
 * This ensures ALL shot creation paths use the same inheritance logic
 * 
 * NOTE: LoRAs no longer inherit as a full set from the last-opened shot.
 * New shots seed at most one project-scoped "last edited LoRA".
 * 
 * Join Segments settings are also inherited separately (joinSegmentsSettings)
 * to preserve the user's last Join mode configuration.
 */
interface InheritSettingsParams {
  newShotId: string;
  projectId: string;
  shots?: Array<{
    id: string;
    name: string;
    created_at?: string;
    settings?: Record<string, unknown>;
  }>;
}

interface InheritedSettings {
  mainSettings: Record<string, unknown> | null;
  uiSettings: Record<string, unknown> | null;
  joinSegmentsSettings: Record<string, unknown> | null; // Join Segments mode settings
  lastEditedLora: LastEditedLoraValue;
}

function asSeedLora(value: unknown): Exclude<LastEditedLoraValue, null | undefined> | undefined {
  const record = toObjectRecord(value);
  if (!record) {
    return undefined;
  }

  const { id, name, path, strength } = record;
  if (
    typeof id !== 'string'
    || typeof name !== 'string'
    || typeof path !== 'string'
    || typeof strength !== 'number'
    || !Number.isFinite(strength)
  ) {
    return undefined;
  }

  return {
    id,
    name,
    path,
    strength,
    ...(typeof record.previewImageUrl === 'string' ? { previewImageUrl: record.previewImageUrl } : {}),
    ...(typeof record.trigger_word === 'string' ? { trigger_word: record.trigger_word } : {}),
  };
}

function getSeedLora(
  mainSettings: Record<string, unknown> | null,
  lastEditedLora: LastEditedLoraValue,
): Exclude<LastEditedLoraValue, null | undefined> | null {
  if (lastEditedLora) {
    return lastEditedLora;
  }

  if (lastEditedLora !== undefined) {
    return null;
  }

  const mainSettingsLoras = Array.isArray(mainSettings?.loras) ? mainSettings.loras : [];
  return asSeedLora(mainSettingsLoras[0]) ?? null;
}

/**
 * Gets inherited settings for a new shot
 * Priority: localStorage (last active) → Database (last created) → Project defaults
 * 
 * Main settings still cascade normally, but LoRAs are resolved separately from
 * the project-level lastEditedLora helper with a soft-migration fallback.
 * Join Segments settings are inherited separately in joinSegmentsSettings
 */
async function getInheritedSettings(
  params: InheritSettingsParams
): Promise<InheritedSettings> {
  const { projectId, shots } = params;
  
  let mainSettings: Record<string, unknown> | null = null;
  let uiSettings: Record<string, unknown> | null = null;
  let joinSegmentsSettings: Record<string, unknown> | null = null;
  let lastEditedLora = readLastEditedLoraFromLocalStorage(projectId);

  // 1. Try to get from localStorage (most recent active shot) - captures unsaved edits
  try {
    const mainStorageKey = STORAGE_KEYS.LAST_ACTIVE_SHOT_SETTINGS(projectId);
    const stored = localStorage.getItem(mainStorageKey);
    if (stored) {
      mainSettings = JSON.parse(stored);
    }
    
    const uiStorageKey = STORAGE_KEYS.LAST_ACTIVE_UI_SETTINGS(projectId);
    const storedUI = localStorage.getItem(uiStorageKey);
    if (storedUI) {
      uiSettings = JSON.parse(storedUI);
    }
    
    // Join Segments settings
    const joinStorageKey = STORAGE_KEYS.LAST_ACTIVE_JOIN_SEGMENTS_SETTINGS(projectId);
    const storedJoin = localStorage.getItem(joinStorageKey);
    if (storedJoin) {
      joinSegmentsSettings = JSON.parse(storedJoin);
    }
  } catch (e) {
    normalizeAndPresentError(e, { context: 'ShotSettingsInheritance', showToast: false });
  }
  
  // 1b. If no project-specific settings AND this is a new project (no shots), try global fallback
  // This enables cross-project inheritance for the first shot in a new project
  const isNewProject = !shots || shots.length === 0;
  if (!mainSettings && isNewProject) {
    try {
      const globalStored = localStorage.getItem(STORAGE_KEYS.GLOBAL_LAST_ACTIVE_SHOT_SETTINGS);
      if (globalStored) {
        mainSettings = JSON.parse(globalStored);
      }
      
      // Also try global Join Segments settings
      if (!joinSegmentsSettings) {
        const globalJoinStored = localStorage.getItem(STORAGE_KEYS.GLOBAL_LAST_ACTIVE_JOIN_SEGMENTS_SETTINGS);
        if (globalJoinStored) {
          joinSegmentsSettings = JSON.parse(globalJoinStored);
        }
      }
    } catch (e) {
      normalizeAndPresentError(e, { context: 'ShotSettingsInheritance', showToast: false });
    }
  }

  // 2. If not found, fall back to latest created shot from DB
  if ((!mainSettings || !joinSegmentsSettings) && shots && shots.length > 0) {
    
    const sortedShots = [...shots].sort(compareByCreatedAtDesc);
    
    const latestShot = sortedShots[0];
    
    if (latestShot) {
      
      if (!mainSettings && latestShot.settings?.[TOOL_IDS.TRAVEL_BETWEEN_IMAGES]) {
        mainSettings = latestShot.settings[TOOL_IDS.TRAVEL_BETWEEN_IMAGES] as Record<string, unknown>;
      }

      if (!joinSegmentsSettings && latestShot.settings?.['join-segments']) {
        joinSegmentsSettings = latestShot.settings['join-segments'] as Record<string, unknown>;
      }
    }
  }

  // 3. Fetch project-level defaults if still missing
  if (!mainSettings || !uiSettings) {
    try {
      const { data: projectData } = await supabase().from('projects')
        .select('settings')
        .eq('id', projectId)
        .single();
      
      const projectSettings = toObjectRecord(projectData?.settings);
      if (!mainSettings && projectSettings?.[TOOL_IDS.TRAVEL_BETWEEN_IMAGES]) {
        mainSettings = projectSettings[TOOL_IDS.TRAVEL_BETWEEN_IMAGES] as Record<string, unknown>;
      }

      if (!uiSettings && projectSettings?.[SETTINGS_IDS.TRAVEL_UI_STATE]) {
        uiSettings = projectSettings[SETTINGS_IDS.TRAVEL_UI_STATE] as Record<string, unknown>;
      }
    } catch (error) {
      normalizeAndPresentError(error, { context: 'ShotSettingsInheritance', showToast: false });
    }
  }

  const lastEditedLoraFromLocal = lastEditedLora;
  if (lastEditedLora === undefined) {
    lastEditedLora = await readLastEditedLoraFromProject(projectId);
  }

  console.log('[LoraSeedDebug][getInheritedSettings]', JSON.stringify({
    projectId,
    newShotId: params.newShotId,
    lastEditedLora_fromLocalStorage: lastEditedLoraFromLocal,
    lastEditedLora_final: lastEditedLora,
    mainSettings_loras: (mainSettings as { loras?: unknown } | null)?.loras,
    mainSettings_keys: mainSettings ? Object.keys(mainSettings) : null,
    shotsCount: params.shots?.length ?? 0,
  }));

  return {
    mainSettings,
    uiSettings,
    joinSegmentsSettings,
    lastEditedLora,
  };
}

/**
 * Applies inherited settings to a new shot
 * Saves main settings to sessionStorage for useShotSettings to pick up
 * Also saves Join Segments settings to sessionStorage for useJoinSegmentsSettings to pick up
 */
function applyInheritedSettings(
  params: InheritSettingsParams,
  inherited: InheritedSettings
): Promise<void> {
  const { newShotId } = params;
  const { mainSettings, uiSettings, joinSegmentsSettings, lastEditedLora } = inherited;
  const { loras: _ignoredInheritedLoras, ...mainSettingsWithoutLoras } = mainSettings ?? {};
  const seedLora = getSeedLora(mainSettings, lastEditedLora);

  console.log('[LoraSeedDebug][applyInheritedSettings]', JSON.stringify({
    newShotId,
    hasMainSettings: !!mainSettings,
    hasUiSettings: !!uiSettings,
    lastEditedLora,
    inheritedLoras: _ignoredInheritedLoras,
    seedLora,
    willSeedLoras: seedLora ? [seedLora] : [],
  }));

  // Save main settings to sessionStorage for useShotSettings to pick up
  if (mainSettings || uiSettings) {
    const defaultsToApply = {
      ...mainSettingsWithoutLoras,
      _uiSettings: uiSettings || {},
      // Always start with empty prompt fields for new shots (don't inherit)
      prompt: '',  // Main prompt for video generation
      textBeforePrompts: '',
      textAfterPrompts: '',
      pairConfigs: [],
      loras: seedLora ? [seedLora] : [],
    };
    const storageKey = STORAGE_KEYS.APPLY_PROJECT_DEFAULTS(newShotId);
    sessionStorage.setItem(storageKey, JSON.stringify(defaultsToApply));
    console.log('[LoraSeedDebug][applyInheritedSettings] sessionStorage written', JSON.stringify({
      storageKey,
      lorasInPayload: defaultsToApply.loras,
    }));
  } else {
    console.log('[LoraSeedDebug][applyInheritedSettings] no mainSettings/uiSettings → sessionStorage NOT written', JSON.stringify({ newShotId }));
  }
  
  // Save Join Segments settings to sessionStorage for useJoinSegmentsSettings to pick up
  if (joinSegmentsSettings) {
    const joinDefaultsToApply = {
      ...joinSegmentsSettings,
      // Clear prompt for new shots (shot-specific, shouldn't inherit)
      prompt: '',
      negativePrompt: '',
    };
    const joinStorageKey = STORAGE_KEYS.APPLY_JOIN_SEGMENTS_DEFAULTS(newShotId);
    sessionStorage.setItem(joinStorageKey, JSON.stringify(joinDefaultsToApply));
    
  }
  
  return Promise.resolve();
}

/**
 * Complete standardized inheritance flow
 * Call this after creating any new shot
 */
export async function inheritSettingsForNewShot(
  params: InheritSettingsParams
): Promise<void> {
  
  const inherited = await getInheritedSettings(params);
  await applyInheritedSettings(params, inherited);
  
}
