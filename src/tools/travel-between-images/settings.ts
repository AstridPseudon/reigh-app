// =============================================================================
// RE-EXPORTS FROM SHARED
// These types were moved to shared/ because they're used across multiple tools.
// Re-exported here for backwards compatibility with existing imports.
// =============================================================================
export {
  type PhaseConfig,
  DEFAULT_PHASE_CONFIG,
  DEFAULT_VACE_PHASE_CONFIG,
  
} from '@/shared/types/phaseConfig';
import type { PhaseConfig } from '@/shared/types/phaseConfig';
import {
  DEFAULT_STRUCTURE_GUIDANCE_CONTROLS,
  DEFAULT_STRUCTURE_VIDEO,
} from '@/shared/lib/tasks/travelBetweenImages/defaults';
import { migrateLegacyStructureVideos } from '@/shared/lib/tasks/travelBetweenImages/legacyStructureVideo';

// Import for local use
import {
  type SteerableMotionSettings,
  DEFAULT_STEERABLE_MOTION_SETTINGS,
} from '@/shared/types/steerableMotion';
import { TOOL_IDS } from '@/shared/lib/tooling/toolIds';
import { asRecord } from '@/shared/lib/typeCoercion';

// =============================================================================
// TOOL-SPECIFIC TYPES
// =============================================================================

// LoRA type for shot settings (simplified version of ActiveLora for persistence)
export interface ShotLora {
  id: string;
  name: string;
  path: string;
  strength: number;
  previewImageUrl?: string;
  trigger_word?: string;
}

export interface VideoTravelSettings {
  videoControlMode: 'individual' | 'batch';
  prompt: string;  // Main prompt for video generation (was batchVideoPrompt)
  negativePrompt?: string;  // Negative prompt (was steerableMotionSettings.negative_prompt)
  batchVideoFrames: number;
  batchVideoSteps: number;
  dimensionSource?: 'project' | 'firstImage' | 'custom'; // Legacy — used by travel tool, may be replaced with aspect-ratio-only in future
  customWidth?: number; // Legacy — used by travel tool, may be replaced with aspect-ratio-only in future
  customHeight?: number; // Legacy — used by travel tool, may be replaced with aspect-ratio-only in future
  steerableMotionSettings: SteerableMotionSettings;  // Still used for seed, debug, model_name
  enhancePrompt: boolean;
  generationMode: 'batch' | 'by-pair' | 'timeline';
  selectedModel?: 'wan-2.1' | 'wan-2.2';
  turboMode: boolean;
  amountOfMotion: number; // 0-100 range for UI (kept for backward compatibility)
  motionMode?: 'basic' | 'advanced'; // Motion control mode (Presets tab merged into Basic)
  advancedMode: boolean; // Toggle for showing phase_config settings
  phaseConfig?: PhaseConfig; // Advanced phase configuration
  selectedPhasePresetId?: string | null; // ID of the selected phase config preset (null if manually configured)
  textBeforePrompts?: string; // Text to prepend to all prompts
  textAfterPrompts?: string; // Text to append to all prompts
  generationTypeMode?: 'i2v' | 'vace'; // Generation type: I2V (image-to-video) or VACE (structure video guided)
  smoothContinuations?: boolean; // Enable SVI (smooth video interpolation) for smoother transitions
  // selectedMode removed - now hardcoded to use specific model
  pairConfigs?: Array<{
    id: string;
    prompt: string;
    frames: number;
    negativePrompt: string;
    context: number;
  }>;
  // Store the shot images as part of settings
  shotImageIds?: string[];
  // LoRAs for this shot (unified field name after DB migration)
  loras?: ShotLora[];
  // Structure video settings (per-shot basis)
  structureVideo?: {
    path: string;
    metadata: {
      duration_seconds: number;
      frame_rate: number;
      total_frames: number;
      width: number;
      height: number;
      file_size: number;
    };
    treatment: 'adjust' | 'clip';
    motionStrength: number;
    structureType?: 'uni3c' | 'flow' | 'canny' | 'depth';
  };
  [key: string]: unknown;
}

export const videoTravelSettings = {
  id: TOOL_IDS.TRAVEL_BETWEEN_IMAGES,
  scope: ['shot'], // Video travel settings are per-shot
  defaults: {
    // Content fields - explicit empty defaults
    // These do NOT inherit to new shots (cleared in shotSettingsInheritance.ts)
    prompt: '',  // Main prompt for video generation
    negativePrompt: '',  // Negative prompt
    pairConfigs: [],
    shotImageIds: [],
    phaseConfig: undefined,
    structureVideo: undefined,
    textBeforePrompts: '',
    textAfterPrompts: '',
    
    // Configuration fields - these inherit to both new shots and new projects
    videoControlMode: 'batch' as const,
    batchVideoFrames: 61, // Must be 4N+1 format for Wan model compatibility (61 = 4*15+1)
    batchVideoSteps: 6,
    dimensionSource: 'firstImage' as const,
    generationMode: 'timeline' as const,
    enhancePrompt: false,
    selectedModel: 'wan-2.1' as const,
    turboMode: false,
    amountOfMotion: 50,
    motionMode: 'basic' as const,
    advancedMode: false,
    steerableMotionSettings: DEFAULT_STEERABLE_MOTION_SETTINGS,
    customWidth: undefined,
    customHeight: undefined,
    generationTypeMode: 'i2v' as const, // Default to I2V (image-to-video) mode
    smoothContinuations: false, // SVI disabled for now
    loras: [] as ShotLora[],
  },
};

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asEnum<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  return typeof value === 'string' && options.includes(value as T) ? value as T : undefined;
}

function cloneVideoTravelDefaults(): VideoTravelSettings {
  return {
    ...videoTravelSettings.defaults,
    steerableMotionSettings: {
      ...DEFAULT_STEERABLE_MOTION_SETTINGS,
      ...videoTravelSettings.defaults.steerableMotionSettings,
    },
    pairConfigs: [...(videoTravelSettings.defaults.pairConfigs ?? [])],
    shotImageIds: [...(videoTravelSettings.defaults.shotImageIds ?? [])],
    loras: [...(videoTravelSettings.defaults.loras ?? [])],
    ...(videoTravelSettings.defaults.phaseConfig
      ? { phaseConfig: videoTravelSettings.defaults.phaseConfig }
      : {}),
    ...(videoTravelSettings.defaults.structureVideo
      ? { structureVideo: { ...videoTravelSettings.defaults.structureVideo } }
      : {}),
  };
}

function normalizeShotLoras(value: unknown): ShotLora[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const id = asString(record.id);
    const name = asString(record.name);
    const path = asString(record.path);
    const strength = asFiniteNumber(record.strength);
    if (!id || !name || !path || strength === undefined) {
      return [];
    }
    return [{
      id,
      name,
      path,
      strength,
      ...(asString(record.previewImageUrl) ? { previewImageUrl: asString(record.previewImageUrl) } : {}),
      ...(asString(record.trigger_word) ? { trigger_word: asString(record.trigger_word) } : {}),
    }];
  });
}

function normalizePairConfigs(value: unknown): VideoTravelSettings['pairConfigs'] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) {
      return [];
    }
    const id = asString(record.id);
    if (!id) {
      return [];
    }
    return [{
      id,
      prompt: asString(record.prompt) ?? '',
      frames: asFiniteNumber(record.frames) ?? videoTravelSettings.defaults.batchVideoFrames,
      negativePrompt: asString(record.negativePrompt) ?? '',
      context: asFiniteNumber(record.context) ?? 0,
    }];
  });
}

function normalizeShotImageIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function normalizeStructureVideo(value: unknown): VideoTravelSettings['structureVideo'] {
  const record = asRecord(value);
  if (record) {
    const path = asString(record.path);
    if (path) {
      return {
        path,
        metadata: asRecord(record.metadata) as VideoTravelSettings['structureVideo']['metadata'],
        treatment: asEnum(record.treatment, ['adjust', 'clip']) ?? DEFAULT_STRUCTURE_VIDEO.treatment,
        motionStrength: asFiniteNumber(record.motionStrength) ?? DEFAULT_STRUCTURE_GUIDANCE_CONTROLS.motionStrength,
        ...(asEnum(record.structureType, ['uni3c', 'flow', 'canny', 'depth'])
          ? { structureType: asEnum(record.structureType, ['uni3c', 'flow', 'canny', 'depth']) }
          : {}),
      };
    }
  }

  const migrated = migrateLegacyStructureVideos(value, {
    defaultEndFrame: videoTravelSettings.defaults.batchVideoFrames,
    defaultVideoTreatment: DEFAULT_STRUCTURE_VIDEO.treatment,
    defaultMotionStrength: DEFAULT_STRUCTURE_GUIDANCE_CONTROLS.motionStrength,
    defaultStructureType: DEFAULT_STRUCTURE_GUIDANCE_CONTROLS.structureType,
    defaultUni3cEndPercent: DEFAULT_STRUCTURE_GUIDANCE_CONTROLS.uni3cEndPercent,
  })[0];
  if (!migrated) {
    return undefined;
  }

  return {
    path: migrated.path,
    metadata: migrated.metadata as VideoTravelSettings['structureVideo']['metadata'],
    treatment: migrated.treatment ?? DEFAULT_STRUCTURE_VIDEO.treatment,
    motionStrength: migrated.motion_strength ?? DEFAULT_STRUCTURE_GUIDANCE_CONTROLS.motionStrength,
    ...(migrated.structure_type ? { structureType: migrated.structure_type } : {}),
  };
}

export function normalizeVideoTravelSettings(value: unknown): VideoTravelSettings {
  const defaults = cloneVideoTravelDefaults();
  const record = asRecord(value);
  if (!record) {
    return defaults;
  }

  return {
    ...defaults,
    prompt: asString(record.prompt) ?? defaults.prompt,
    negativePrompt: asString(record.negativePrompt) ?? defaults.negativePrompt,
    batchVideoFrames: asFiniteNumber(record.batchVideoFrames) ?? defaults.batchVideoFrames,
    batchVideoSteps: asFiniteNumber(record.batchVideoSteps) ?? defaults.batchVideoSteps,
    dimensionSource: asEnum(record.dimensionSource, ['project', 'firstImage', 'custom']) ?? defaults.dimensionSource,
    customWidth: asFiniteNumber(record.customWidth) ?? defaults.customWidth,
    customHeight: asFiniteNumber(record.customHeight) ?? defaults.customHeight,
    steerableMotionSettings: {
      ...defaults.steerableMotionSettings,
      ...(asRecord(record.steerableMotionSettings) ?? {}),
    },
    enhancePrompt: asBoolean(record.enhancePrompt) ?? defaults.enhancePrompt,
    generationMode: asEnum(record.generationMode, ['batch', 'by-pair', 'timeline']) ?? defaults.generationMode,
    selectedModel: asEnum(record.selectedModel, ['wan-2.1', 'wan-2.2']) ?? defaults.selectedModel,
    turboMode: asBoolean(record.turboMode) ?? defaults.turboMode,
    amountOfMotion: asFiniteNumber(record.amountOfMotion) ?? defaults.amountOfMotion,
    motionMode: asEnum(record.motionMode, ['basic', 'advanced']) ?? defaults.motionMode,
    advancedMode: asBoolean(record.advancedMode) ?? defaults.advancedMode,
    phaseConfig: (asRecord(record.phaseConfig) as PhaseConfig | null) ?? defaults.phaseConfig,
    selectedPhasePresetId: (record.selectedPhasePresetId === null || typeof record.selectedPhasePresetId === 'string')
      ? record.selectedPhasePresetId
      : defaults.selectedPhasePresetId,
    textBeforePrompts: asString(record.textBeforePrompts) ?? defaults.textBeforePrompts,
    textAfterPrompts: asString(record.textAfterPrompts) ?? defaults.textAfterPrompts,
    generationTypeMode: asEnum(record.generationTypeMode, ['i2v', 'vace']) ?? defaults.generationTypeMode,
    smoothContinuations: asBoolean(record.smoothContinuations) ?? defaults.smoothContinuations,
    pairConfigs: normalizePairConfigs(record.pairConfigs),
    shotImageIds: normalizeShotImageIds(record.shotImageIds),
    loras: normalizeShotLoras(record.loras),
    structureVideo: normalizeStructureVideo(record.structureVideo ?? record),
  };
}

export function createDefaultVideoTravelSettings(): VideoTravelSettings {
  return cloneVideoTravelDefaults();
}
