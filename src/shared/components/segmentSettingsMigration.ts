/**
 * Segment Settings Migration
 *
 * Format conversion between old/new/legacy metadata formats.
 *
 * Extracted from segmentSettingsUtils.ts to separate the migration/compatibility
 * layer from the public API (presets, helpers, task params).
 *
 * Functions here handle:
 * - Reading settings from variant/generation params (multiple legacy formats)
 * - Building metadata updates (writing new format + cleaning old fields)
 * - Converting between lora formats (legacy object, pair array, ActiveLora)
 *
 * The PairMetadata type defines ALL known metadata shapes (new, deprecated pair_*,
 * and legacy user_overrides) so callers can type-check against any format.
 */

import type { PhaseConfig } from '@/shared/types/phaseConfig';
import type { ActiveLora } from '@/shared/hooks/useLoraManager';
import { writeSegmentOverrides, type SegmentOverrides, type LoraConfig } from '@/shared/utils/settingsMigration';
import type { SegmentSettings } from './segmentSettingsUtils';
import { stripModeFromPhaseConfig } from './segmentSettingsUtils';

// =============================================================================
// PAIR METADATA TYPE (all known metadata shapes)
// =============================================================================

/**
 * PairMetadata defines the shape of shot_generations.metadata.
 * Includes new format (segmentOverrides), deprecated pair_* fields,
 * and legacy user_overrides for backward compatibility.
 */
export interface PairMetadata {
  // NEW FORMAT: Segment overrides in nested structure
  segmentOverrides?: {
    prompt?: string;
    negativePrompt?: string;
    motionMode?: 'basic' | 'advanced';
    amountOfMotion?: number; // 0-100 scale
    phaseConfig?: PhaseConfig;
    selectedPhasePresetId?: string | null;
    loras?: Array<{ path: string; strength: number; id?: string; name?: string }>;
    numFrames?: number;
    randomSeed?: boolean;
    seed?: number;
  };
  // AI-generated prompt (not user settings, kept separate)
  enhanced_prompt?: string;
  // DEPRECATED: Old pair_* fields (kept for backward compatibility during migration)
  /** @deprecated Use segmentOverrides.prompt instead */
  pair_prompt?: string;
  /** @deprecated Use segmentOverrides.negativePrompt instead */
  pair_negative_prompt?: string;
  /** @deprecated Use segmentOverrides.phaseConfig instead */
  pair_phase_config?: PhaseConfig;
  /** @deprecated Use segmentOverrides.motionMode and segmentOverrides.amountOfMotion instead */
  pair_motion_settings?: {
    motion_mode?: 'basic' | 'advanced';
    amount_of_motion?: number;
  };
  /** @deprecated Use segmentOverrides.loras instead */
  pair_loras?: Array<{ path: string; strength: number }>;
  /** @deprecated Use segmentOverrides.numFrames instead */
  pair_num_frames?: number;
  /** @deprecated Use segmentOverrides.randomSeed instead */
  pair_random_seed?: boolean;
  /** @deprecated Use segmentOverrides.seed instead */
  pair_seed?: number;
  /** @deprecated Use segmentOverrides.selectedPhasePresetId instead */
  pair_selected_phase_preset_id?: string | null;
  // LEGACY: Very old format nested in user_overrides
  /** @deprecated Use segmentOverrides instead */
  user_overrides?: {
    phase_config?: PhaseConfig;
    motion_mode?: 'basic' | 'advanced';
    amount_of_motion?: number;
    additional_loras?: Record<string, number>;
    [key: string]: unknown;
  };
}

// =============================================================================
// LORA FORMAT CONVERTERS
// =============================================================================

/** Convert legacy loras format (Record<url, strength>) to ActiveLora[] */
function legacyLorasToArray(lorasObj: Record<string, number>): ActiveLora[] {
  return Object.entries(lorasObj).map(([url, strength]) => {
    const filename = url.split('/').pop()?.replace('.safetensors', '') || url;
    return {
      id: url,
      name: filename,
      path: url,
      strength: typeof strength === 'number' ? strength : 1.0,
    };
  });
}

/** Convert pair_loras format (Array<{path, strength}>) to ActiveLora[] */
function pairLorasToArray(pairLoras: Array<{ path: string; strength: number }>): ActiveLora[] {
  return pairLoras.map((lora) => {
    const filename = lora.path.split('/').pop()?.replace('.safetensors', '') || lora.path;
    return {
      id: lora.path,
      name: filename,
      path: lora.path,
      strength: lora.strength,
    };
  });
}

// =============================================================================
// EXTRACT SETTINGS FROM PARAMS
// =============================================================================

/**
 * Extract SegmentSettings from variant/generation params.
 * Used to populate the form with settings from an existing generation.
 *
 * Handles multiple legacy formats:
 * - Top-level fields (base_prompt, amount_of_motion, etc.)
 * - Nested orchestrator_details
 * - Legacy additional_loras (object format)
 * - New loras (array format)
 */
export function extractSettingsFromParams(
  params: Record<string, unknown>,
  defaults?: Partial<SegmentSettings>
): SegmentSettings {

  // Handle nested orchestrator_details (common in task params)
  const orchDetails = (params.orchestrator_details || {}) as Record<string, unknown>;

  // Extract prompt: base_prompt > prompt > orchestrator > default
  const prompt = (params.base_prompt ?? params.prompt ?? orchDetails.base_prompt ?? defaults?.prompt ?? '') as string;

  // Extract negative prompt
  const negativePrompt = (params.negative_prompt ?? orchDetails.negative_prompt ?? defaults?.negativePrompt ?? '') as string;

  // Extract num_frames
  const numFrames = (params.num_frames ?? orchDetails.num_frames ?? defaults?.numFrames ?? 25) as number;

  // Extract seed/randomSeed
  const randomSeed = (params.random_seed ?? orchDetails.random_seed ?? defaults?.randomSeed ?? true) as boolean;
  const seed = (params.seed ?? orchDetails.seed ?? defaults?.seed) as number | undefined;

  // Extract motion settings
  const motionMode = (params.motion_mode ?? orchDetails.motion_mode ?? defaults?.motionMode ?? 'basic') as 'basic' | 'advanced';
  const amountOfMotion = params.amount_of_motion != null
    ? Math.round((params.amount_of_motion as number) * 100) // Convert 0-1 to 0-100
    : (orchDetails.amount_of_motion != null
        ? Math.round((orchDetails.amount_of_motion as number) * 100)
        : (defaults?.amountOfMotion ?? 50));

  // Extract phase config (only if advanced mode)
  let phaseConfig: PhaseConfig | undefined = undefined;
  if (motionMode === 'advanced') {
    phaseConfig = (params.phase_config ?? orchDetails.phase_config ?? defaults?.phaseConfig) as PhaseConfig | undefined;
    if (phaseConfig) {
      phaseConfig = stripModeFromPhaseConfig(phaseConfig);
    }
  }

  // Extract selected preset ID
  const selectedPhasePresetId = (params.selected_phase_preset_id ?? orchDetails.selected_phase_preset_id ?? defaults?.selectedPhasePresetId ?? null) as string | null;

  // Extract LoRAs - handle multiple formats
  let loras: ActiveLora[] = [];

  // Format 1: loras array at top level (new format)
  if (Array.isArray(params.loras) && params.loras.length > 0) {
    loras = pairLorasToArray(params.loras as Array<{ path: string; strength: number }>);
  }
  // Format 2: additional_loras object at top level (legacy)
  else if (params.additional_loras && typeof params.additional_loras === 'object' && Object.keys(params.additional_loras as Record<string, unknown>).length > 0) {
    loras = legacyLorasToArray(params.additional_loras as Record<string, number>);
  }
  // Format 3: in orchestrator_details (either format)
  else if (Array.isArray(orchDetails.loras) && orchDetails.loras.length > 0) {
    loras = pairLorasToArray(orchDetails.loras as Array<{ path: string; strength: number }>);
  }
  else if (orchDetails.additional_loras && typeof orchDetails.additional_loras === 'object' && Object.keys(orchDetails.additional_loras as Record<string, unknown>).length > 0) {
    loras = legacyLorasToArray(orchDetails.additional_loras as Record<string, number>);
  }
  // Format 4: use defaults if provided
  else if (defaults?.loras) {
    loras = defaults.loras;
  }

  const result = {
    prompt,
    negativePrompt,
    motionMode,
    amountOfMotion,
    phaseConfig,
    selectedPhasePresetId,
    loras,
    numFrames,
    randomSeed,
    seed,
    makePrimaryVariant: defaults?.makePrimaryVariant ?? false,
  };

  return result;
}

// =============================================================================
// BUILD METADATA UPDATE
// =============================================================================

/**
 * Settings to save to pair metadata.
 * Convention:
 *   undefined = don't touch this field
 *   null = explicitly clear (for nullable fields)
 *   '' = explicitly clear override (for string fields)
 *   value = set the override
 */
interface PairSettingsToSave {
  prompt?: string;
  negativePrompt?: string;
  textBeforePrompts?: string;
  textAfterPrompts?: string;
  motionMode?: 'basic' | 'advanced';
  amountOfMotion?: number;
  phaseConfig?: PhaseConfig | null; // null means clear
  loras?: ActiveLora[];
  // Video settings
  numFrames?: number;
  randomSeed?: boolean;
  seed?: number;
  // UI state
  selectedPhasePresetId?: string | null;
  // Structure video overrides
  structureMotionStrength?: number;
  structureTreatment?: 'adjust' | 'clip';
  structureUni3cEndPercent?: number;
}

/**
 * Build metadata update payload for saving pair settings.
 *
 * Writes to the new segmentOverrides format and cleans up old pair_* and
 * legacy user_overrides fields from the metadata.
 */
export function buildMetadataUpdate(
  currentMetadata: Record<string, unknown>,
  settings: PairSettingsToSave
): Record<string, unknown> {

  // Convert PairSettingsToSave to SegmentOverrides format for new storage
  // Convention:
  //   undefined = don't touch this field (keep existing value)
  //   '' (empty) = explicitly clear the override (use shot default)
  //   'value' = set the override
  const overrides: SegmentOverrides = {};

  // Track fields that should be explicitly cleared (set to '' means remove override)
  const fieldsToClear: (keyof SegmentOverrides)[] = [];

  if (settings.prompt !== undefined) {
    if (settings.prompt === '') {
      fieldsToClear.push('prompt');
    } else {
      overrides.prompt = settings.prompt;
    }
  }
  if (settings.negativePrompt !== undefined) {
    if (settings.negativePrompt === '') {
      fieldsToClear.push('negativePrompt');
    } else {
      overrides.negativePrompt = settings.negativePrompt;
    }
  }
  if (settings.textBeforePrompts !== undefined) {
    if (settings.textBeforePrompts === '') {
      fieldsToClear.push('textBeforePrompts');
    } else {
      overrides.textBeforePrompts = settings.textBeforePrompts;
    }
  }
  if (settings.textAfterPrompts !== undefined) {
    if (settings.textAfterPrompts === '') {
      fieldsToClear.push('textAfterPrompts');
    } else {
      overrides.textAfterPrompts = settings.textAfterPrompts;
    }
  }
  // Motion settings: null = clear, undefined = don't touch, value = set
  if (settings.motionMode !== undefined) {
    if (settings.motionMode === null) {
      fieldsToClear.push('motionMode');
    } else {
      overrides.motionMode = settings.motionMode;
    }
  }
  if (settings.amountOfMotion !== undefined) {
    if (settings.amountOfMotion === null) {
      fieldsToClear.push('amountOfMotion');
    } else {
      // Store in 0-100 scale (UI scale) in new format
      overrides.amountOfMotion = settings.amountOfMotion;
    }
  }
  if (settings.phaseConfig !== undefined) {
    if (settings.phaseConfig === null) {
      fieldsToClear.push('phaseConfig');
    } else {
      overrides.phaseConfig = stripModeFromPhaseConfig(settings.phaseConfig);
    }
  }
  if (settings.loras !== undefined) {
    if (settings.loras === null) {
      fieldsToClear.push('loras');
    } else {
      // Convert ActiveLora[] to LoraConfig[]
      overrides.loras = settings.loras.map((l): LoraConfig => ({
        id: l.id,
        name: l.name,
        path: l.path,
        strength: l.strength,
      }));
    }
  }
  // Note: numFrames is NOT saved - timeline positions are the source of truth
  if (settings.randomSeed !== undefined) {
    overrides.randomSeed = settings.randomSeed;
  }
  if (settings.seed !== undefined) {
    overrides.seed = settings.seed;
  }
  if (settings.selectedPhasePresetId !== undefined) {
    if (settings.selectedPhasePresetId === null) {
      fieldsToClear.push('selectedPhasePresetId');
    } else {
      overrides.selectedPhasePresetId = settings.selectedPhasePresetId;
    }
  }
  // Structure video overrides: null = clear, undefined = don't touch, value = set
  if (settings.structureMotionStrength !== undefined) {
    if (settings.structureMotionStrength === null) {
      fieldsToClear.push('structureMotionStrength');
    } else {
      overrides.structureMotionStrength = settings.structureMotionStrength;
    }
  }
  if (settings.structureTreatment !== undefined) {
    if (settings.structureTreatment === null) {
      fieldsToClear.push('structureTreatment');
    } else {
      overrides.structureTreatment = settings.structureTreatment;
    }
  }
  if (settings.structureUni3cEndPercent !== undefined) {
    if (settings.structureUni3cEndPercent === null) {
      fieldsToClear.push('structureUni3cEndPercent');
    } else {
      overrides.structureUni3cEndPercent = settings.structureUni3cEndPercent;
    }
  }

  // Use writeSegmentOverrides to write to new format
  const newMetadata = writeSegmentOverrides(currentMetadata, overrides);

  // Access segmentOverrides as a mutable record for cleanup operations
  const segOverrides = newMetadata.segmentOverrides as Record<string, unknown> | undefined;

  // Handle explicit clear of phaseConfig (when switching to basic mode)
  if (settings.phaseConfig === null && segOverrides) {
    delete segOverrides.phaseConfig;
    // Note: selectedPhasePresetId is handled independently via fieldsToClear.
    // Don't cascade-delete it here — basic mode presets need to persist.
  }

  // Handle explicitly cleared fields ('' means remove override, use shot default)
  if (fieldsToClear.length > 0 && segOverrides) {
    for (const field of fieldsToClear) {
      delete segOverrides[field];
    }
  }

  // Clean up old pair_* fields (migration cleanup)
  // These fields are now stored in segmentOverrides
  if (settings.prompt !== undefined) {
    delete newMetadata.pair_prompt;
  }
  if (settings.negativePrompt !== undefined) {
    delete newMetadata.pair_negative_prompt;
  }
  if (settings.motionMode !== undefined || settings.amountOfMotion !== undefined) {
    delete newMetadata.pair_motion_settings;
  }
  if (settings.phaseConfig !== undefined) {
    delete newMetadata.pair_phase_config;
  }
  if (settings.loras !== undefined) {
    delete newMetadata.pair_loras;
  }
  if (settings.randomSeed !== undefined) {
    delete newMetadata.pair_random_seed;
  }
  if (settings.seed !== undefined) {
    delete newMetadata.pair_seed;
  }
  if (settings.selectedPhasePresetId !== undefined) {
    delete newMetadata.pair_selected_phase_preset_id;
  }

  // Clean up legacy user_overrides if present
  const userOverrides = newMetadata.user_overrides as Record<string, unknown> | undefined;
  if (userOverrides) {
    if (settings.motionMode !== undefined) delete userOverrides.motion_mode;
    if (settings.amountOfMotion !== undefined) delete userOverrides.amount_of_motion;
    if (settings.phaseConfig !== undefined) delete userOverrides.phase_config;
    if (settings.loras !== undefined) delete userOverrides.additional_loras;

    // Clean up empty user_overrides
    if (Object.keys(userOverrides).length === 0) {
      delete newMetadata.user_overrides;
    }
  }

  return newMetadata;
}
