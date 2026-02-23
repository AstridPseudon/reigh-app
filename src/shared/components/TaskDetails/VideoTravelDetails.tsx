import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { TaskDetailsProps, getVariantConfig } from '@/shared/types/taskDetailsTypes';
import { parseTaskParams, deriveInputImages, derivePrompt } from '@/shared/lib/taskParamsUtils';
import { getDisplayNameFromUrl } from '@/shared/lib/loraUtils';
import { supabase } from '@/integrations/supabase/client';
import { presetQueryKeys } from '@/shared/lib/queryKeys/presets';
import type { PhaseSettings, PhaseLoraConfig } from '@/shared/types/phaseConfig';

// Built-in preset ID → name mapping (matches segmentSettingsUtils.ts)
const BUILTIN_PRESET_NAMES: Record<string, string> = {
  '__builtin_default_i2v__': 'Basic',
  '__builtin_default_vace__': 'Basic',
};

type UnknownRecord = Record<string, unknown>;

function asRecordOrUndefined(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

function asNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const parsed = asString(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

/**
 * Task details for video travel/generation tasks
 * Shows: variant name, guidance images, phase settings, video/style reference, prompts, technical settings, LoRAs
 */
export const VideoTravelDetails: React.FC<TaskDetailsProps> = ({
  task,
  inputImages,
  variant,
  isMobile = false,
  showAllImages = false,
  onShowAllImagesChange,
  showFullPrompt = false,
  onShowFullPromptChange,
  showFullNegativePrompt = false,
  onShowFullNegativePromptChange,
  availableLoras,
  showCopyButtons = false,
}) => {
  const config = getVariantConfig(variant, isMobile, inputImages.length);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedLoraUrl, setCopiedLoraUrl] = useState<string | null>(null);

  const handleCopyPrompt = async (text: string, setStateFn: (val: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setStateFn(true);
    setTimeout(() => setStateFn(false), 2000);
  };

  const parsedParams = useMemo(() => parseTaskParams(task?.params), [task?.params]);
  const derivedImages = useMemo(() => deriveInputImages(parsedParams), [parsedParams]);

  // For segment tasks, prefer derived images from task params (they're more accurate)
  // For other tasks, use inputImages if provided, otherwise derived
  const isSegmentTaskCheck = parsedParams?.segment_index !== undefined;
  const effectiveInputImages = (isSegmentTaskCheck && derivedImages.length > 0)
    ? derivedImages
    : (inputImages.length > 0 ? inputImages : derivedImages);

  const orchestratorDetails = asRecordOrUndefined(parsedParams?.orchestrator_details);
  const orchestratorPayload = asRecordOrUndefined(parsedParams?.full_orchestrator_payload);
  const individualSegmentParams = asRecordOrUndefined(parsedParams?.individual_segment_params);

  // Phase config
  const phaseConfig = useMemo(() => (
    asRecordOrUndefined(individualSegmentParams?.phase_config) ||
    asRecordOrUndefined(orchestratorPayload?.phase_config) ||
    asRecordOrUndefined(orchestratorDetails?.phase_config) ||
    asRecordOrUndefined(parsedParams?.phase_config)
  ), [individualSegmentParams, orchestratorPayload, orchestratorDetails, parsedParams]);

  // Check if in advanced mode - if not, we show additional_loras instead of phase config
  const isAdvancedMode = useMemo(() => {
    const advancedMode = individualSegmentParams?.advanced_mode ??
      orchestratorDetails?.advanced_mode ??
      orchestratorPayload?.advanced_mode ??
      parsedParams?.advanced_mode;
    const motionMode = individualSegmentParams?.motion_mode ??
      orchestratorDetails?.motion_mode ??
      orchestratorPayload?.motion_mode ??
      parsedParams?.motion_mode;

    const hasPhaseConfig = !!phaseConfig?.phases?.length;

    // advanced_mode explicitly false means basic mode
    // motion_mode === 'basic' means basic mode
    // Otherwise, if we have phase config with phases, assume advanced mode for backward compatibility
    if (advancedMode === false || motionMode === 'basic') {
      return false;
    }
    return advancedMode === true || motionMode === 'advanced' || motionMode === 'presets' || hasPhaseConfig;
  }, [individualSegmentParams, orchestratorDetails, orchestratorPayload, parsedParams, phaseConfig]);

  const phaseStepsDisplay = useMemo(() => {
    if (!phaseConfig?.steps_per_phase || !Array.isArray(phaseConfig.steps_per_phase)) return null;
    const stepsArray = phaseConfig.steps_per_phase;
    const total = stepsArray.reduce((a: number, b: number) => a + b, 0);
    return `${stepsArray.join(' → ')} (${total} total)`;
  }, [phaseConfig?.steps_per_phase]);

  const additionalLoras = (
    asRecordOrUndefined(individualSegmentParams?.additional_loras) ||
    asRecordOrUndefined(orchestratorPayload?.additional_loras) ||
    asRecordOrUndefined(orchestratorDetails?.additional_loras) ||
    asRecordOrUndefined(parsedParams?.additional_loras)
  );

  // Segment info
  const isSegmentTask = parsedParams?.segment_index !== undefined;

  // Layout for two-column on large screens when phases present AND in advanced mode
  // In basic mode, we don't show phase config details even if they exist internally
  const showPhaseContentInRightColumn = isAdvancedMode && phaseConfig?.phases && variant === 'panel';

  // Get prompt using shared utility
  const prompt = useMemo(() => derivePrompt(parsedParams), [parsedParams]);

  const orchestratorNegativePrompts = asStringArray(orchestratorDetails?.negative_prompts_expanded);
  const payloadNegativePrompts = asStringArray(orchestratorPayload?.negative_prompts_expanded);
  const negativePrompt = asString(individualSegmentParams?.negative_prompt) ||
    (isSegmentTask
      ? asString(parsedParams?.negative_prompt)
      : (orchestratorNegativePrompts?.[0] || payloadNegativePrompts?.[0] || asString(parsedParams?.negative_prompt)));

  const enhancePrompt = pickString(
    orchestratorDetails?.enhance_prompt,
    orchestratorPayload?.enhance_prompt,
    parsedParams?.enhance_prompt
  );

  // Structure guidance (new format with videos array, target, strength, step_window)
  const structureGuidance = (
    asRecordOrUndefined(orchestratorDetails?.structure_guidance) ||
    asRecordOrUndefined(orchestratorPayload?.structure_guidance) ||
    asRecordOrUndefined(parsedParams?.structure_guidance)
  );

  // Video/style reference - prefer new structure_guidance.videos format, fall back to legacy fields
  const structureVideos = structureGuidance?.videos;
  const structureVideo = Array.isArray(structureVideos) ? asRecordOrUndefined(structureVideos[0]) : undefined;
  const videoPath = pickString(
    structureVideo?.path,
    orchestratorDetails?.structure_video_path,
    orchestratorPayload?.structure_video_path,
    parsedParams?.structure_video_path
  );
  const videoTreatment = pickString(
    structureVideo?.treatment,
    orchestratorDetails?.structure_video_treatment,
    orchestratorPayload?.structure_video_treatment,
    parsedParams?.structure_video_treatment
  );
  const motionStrength = asNumber(orchestratorDetails?.structure_video_motion_strength)
    ?? asNumber(orchestratorPayload?.structure_video_motion_strength)
    ?? asNumber(parsedParams?.structure_video_motion_strength);

  const styleImage = pickString(parsedParams?.style_reference_image, orchestratorDetails?.style_reference_image);
  const styleStrength = asNumber(parsedParams?.style_reference_strength) ?? asNumber(orchestratorDetails?.style_reference_strength);

  // Preset
  const presetId = pickString(
    individualSegmentParams?.selected_phase_preset_id,
    orchestratorDetails?.selected_phase_preset_id,
    orchestratorPayload?.selected_phase_preset_id,
    parsedParams?.selected_phase_preset_id
  );

  const isDbPreset = presetId && !presetId.startsWith('__builtin_');

  const { data: dbPresetName } = useQuery({
    queryKey: presetQueryKeys.name(presetId ?? ''),
    queryFn: async () => {
      if (!presetId) return null;
      const { data } = await supabase
        .from('resources')
        .select('metadata')
        .eq('id', presetId)
        .single();
      return asString(asRecordOrUndefined(data?.metadata)?.name) || null;
    },
    enabled: !!isDbPreset && !!presetId,
    staleTime: Infinity,
  });

  const presetName = presetId
    ? (BUILTIN_PRESET_NAMES[presetId] || dbPresetName || null)
    : null;

  // Technical settings
  const modelName = pickString(orchestratorDetails?.model_name, orchestratorPayload?.model_name, parsedParams?.model_name);
  const resolution = pickString(orchestratorDetails?.parsed_resolution_wh, parsedParams?.parsed_resolution_wh);
  const orchestratorSegmentFrames = asNumberArray(orchestratorDetails?.segment_frames_expanded);
  const payloadSegmentFrames = asNumberArray(orchestratorPayload?.segment_frames_expanded);
  const parsedSegmentFrames = asNumberArray(parsedParams?.segment_frames_expanded);
  const frames = isSegmentTask
    ? (asNumber(individualSegmentParams?.num_frames) || asNumber(parsedParams?.num_frames) || asNumber(parsedParams?.segment_frames_target))
    : (orchestratorSegmentFrames?.[0] || payloadSegmentFrames?.[0] || parsedSegmentFrames?.[0]);

  const formatModelName = (name: string) => {
    return name
      .replace(/wan_2_2_i2v_lightning_baseline_(\d+)_(\d+)_(\d+)/, 'Wan 2.2 I2V Lightning ($1.$2.$3)')
      .replace(/wan_2_2_i2v_baseline_(\d+)_(\d+)_(\d+)/, 'Wan 2.2 I2V Baseline ($1.$2.$3)')
      .replace(/wan_2_2_i2v_lightning/, 'Wan 2.2 I2V Lightning')
      .replace(/wan_2_2_i2v/, 'Wan 2.2 I2V')
      .replace(/_/g, ' ');
  };

  const renderPhasesList = (phases: PhaseSettings[], stepsPerPhase?: number[]) => (
    <>
      {phases.map((phase: PhaseSettings, phaseIndex: number) => (
        <div key={phase.phase} className="space-y-1">
          <p className={`${config.textSize} font-medium`}>Phase {phase.phase}</p>
          <div className="ml-2 space-y-1">
            <div className="flex gap-3">
              <span className={`${config.textSize} text-muted-foreground`}>Guidance: <span className={`${config.fontWeight} text-foreground`}>{Number(phase.guidance_scale).toFixed(1)}</span></span>
              {stepsPerPhase?.[phaseIndex] !== undefined && (
                <span className={`${config.textSize} text-muted-foreground`}>Steps: <span className={`${config.fontWeight} text-foreground`}>{stepsPerPhase[phaseIndex]}</span></span>
              )}
            </div>
            {phase.loras?.length > 0 && phase.loras.map((lora: PhaseLoraConfig & { name?: string }, idx: number) => (
              <div key={idx} className={`group/lora flex items-center gap-2 p-1.5 bg-background/50 rounded border ${config.textSize} min-w-0`}>
                <span className={`${config.fontWeight} truncate min-w-0 flex-1`}>{getDisplayNameFromUrl(lora.url, availableLoras, lora.name)}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(lora.url); setCopiedLoraUrl(lora.url); setTimeout(() => setCopiedLoraUrl(null), 2000); }}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/lora:opacity-100 shrink-0"
                  title="Copy LoRA URL"
                >
                  {copiedLoraUrl === lora.url ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
                <span className="text-muted-foreground shrink-0">{Number(lora.multiplier).toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  /** Renders the "Phase Settings" summary + phases list. Used in both inline and right-column layouts. */
  const renderPhaseConfigSection = (opts: { showSummary: boolean; borderTop?: string }) => {
    if (!phaseConfig?.phases || phaseConfig.phases.length === 0) return null;
    return (
      <>
        {opts.showSummary && (
          <div className="space-y-2">
            <p className={`${config.textSize} font-medium text-muted-foreground`}>Phase Settings</p>
            <div className="grid grid-cols-2 gap-2">
              <div><span className={`${config.textSize} text-muted-foreground`}>Phases:</span> <span className={`${config.textSize} ${config.fontWeight}`}>{phaseConfig.num_phases || phaseConfig.phases?.length}</span></div>
              {phaseConfig.flow_shift !== undefined && <div><span className={`${config.textSize} text-muted-foreground`}>Flow Shift:</span> <span className={`${config.textSize} ${config.fontWeight}`}>{phaseConfig.flow_shift}</span></div>}
              {phaseConfig.sample_solver && <div><span className={`${config.textSize} text-muted-foreground`}>Solver:</span> <span className={`${config.textSize} ${config.fontWeight} capitalize`}>{phaseConfig.sample_solver}</span></div>}
            </div>
            {phaseStepsDisplay && <div><span className={`${config.textSize} text-muted-foreground`}>Steps per Phase:</span> <span className={`${config.textSize} ${config.fontWeight}`}>{phaseStepsDisplay}</span></div>}
          </div>
        )}
        <div className={`${opts.borderTop ?? 'pt-2'} border-t border-muted-foreground/20 space-y-2`}>
          <p className={`${config.textSize} font-medium text-muted-foreground`}>Phases</p>
          {renderPhasesList(phaseConfig.phases, phaseConfig.steps_per_phase)}
        </div>
      </>
    );
  };

  return (
    <div className={`p-3 bg-muted/30 rounded-lg border ${showPhaseContentInRightColumn ? 'w-full grid grid-cols-1 lg:grid-cols-2 gap-4' : ''} ${!showPhaseContentInRightColumn && variant === 'panel' ? '' : variant === 'modal' && isMobile ? 'w-full' : !showPhaseContentInRightColumn ? 'w-[360px]' : ''}`}>
      {/* Main Content Column */}
      <div className={showPhaseContentInRightColumn ? 'space-y-4 min-w-0' : 'space-y-4'}>
        {/* Guidance Images */}
        {/* Guidance Images + Structure Video side by side */}
        {(effectiveInputImages.length > 0 || videoPath) && (
          <div className="flex gap-3 items-start">
            {effectiveInputImages.length > 0 && (
              <div className="gap-y-1.5 flex-1 min-w-0">
                <p className={`${config.textSize} font-medium text-muted-foreground`}>
                  Image Guidance ({effectiveInputImages.length})
                </p>
                <div className={`grid gap-1 ${config.imageGridCols}`}>
                  {(showAllImages ? effectiveInputImages : effectiveInputImages.slice(0, config.maxImages)).map((img, i) => (
                    <img key={i} src={img} alt={`Input ${i + 1}`} className="w-full aspect-square object-cover rounded border shadow-sm" />
                  ))}
                  {effectiveInputImages.length > config.maxImages && !showAllImages && (
                    <div onClick={() => onShowAllImagesChange?.(true)} className="w-full aspect-square bg-muted/50 hover:bg-muted/70 rounded border cursor-pointer flex items-center justify-center">
                      <span className={`${config.textSize} text-muted-foreground font-medium`}>{effectiveInputImages.length - config.maxImages} more</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {videoPath && (
              <div className="space-y-1.5 shrink-0">
                <p className={`${config.textSize} font-medium text-muted-foreground`}>
                  {structureGuidance?.target ? 'Structure' : 'Video'}
                </p>
                <div className="flex items-start gap-2">
                  <div className="relative group cursor-pointer shrink-0" style={{ width: '80px' }} onClick={() => setVideoLoaded(true)}>
                    {!videoLoaded ? (
                      <div className="w-full aspect-video bg-black rounded border flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      </div>
                    ) : (
                      <video src={videoPath} className="w-full rounded border" loop muted playsInline autoPlay />
                    )}
                  </div>
                  <div className={`${config.textSize} ${config.fontWeight} space-y-0.5`}>
                    {structureGuidance?.strength != null && (
                      <div><span className="text-muted-foreground">Str: </span>{structureGuidance.strength}</div>
                    )}
                    {structureGuidance?.step_window && Array.isArray(structureGuidance.step_window) && (
                      <div><span className="text-muted-foreground">Window: </span>{structureGuidance.step_window[0]}→{structureGuidance.step_window[1]}</div>
                    )}
                    {videoTreatment && <div className="text-muted-foreground capitalize">{videoTreatment}</div>}
                    {motionStrength != null && <div><span className="text-muted-foreground">Motion: </span>{Math.round(motionStrength * 100)}%</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Style Reference */}
        {styleImage && (
          <div className="space-y-1.5">
            <p className={`${config.textSize} font-medium text-muted-foreground`}>Style Reference</p>
            <div className="flex items-center gap-3">
              <img src={styleImage} alt="Style" className="w-[80px] object-cover rounded border" />
              {styleStrength != null && <span className={`${config.textSize} ${config.fontWeight}`}>Strength: {Math.round(styleStrength * 100)}%</span>}
            </div>
          </div>
        )}

        {/* Preset */}
        {presetName && (
          <div className="space-y-1">
            <p className={`${config.textSize} font-medium text-muted-foreground`}>Motion Preset</p>
            <p className={`${config.textSize} ${config.fontWeight}`}>{presetName}</p>
          </div>
        )}

        {/* Prompts */}
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className={`${config.textSize} font-medium text-muted-foreground`}>Prompt{enhancePrompt ? ' (enhanced)' : ''}</p>
              {prompt && showCopyButtons && (
                <button
                  onClick={() => handleCopyPrompt(prompt, setCopiedPrompt)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy prompt"
                >
                  {copiedPrompt ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <p className={`${config.textSize} ${config.fontWeight} text-foreground break-words whitespace-pre-wrap preserve-case`}>
              {prompt ? (showFullPrompt || prompt.length <= config.promptLength ? prompt : prompt.slice(0, config.promptLength) + '...') : 'None'}
            </p>
            {prompt && prompt.length > config.promptLength && onShowFullPromptChange && (
              <Button variant="ghost" size="sm" onClick={() => onShowFullPromptChange(!showFullPrompt)} className="h-6 px-0 text-xs text-primary">
                {showFullPrompt ? 'Show Less' : 'Show More'}
              </Button>
            )}
          </div>
          {negativePrompt && negativePrompt !== 'N/A' && (
            <div className="space-y-1">
              <p className={`${config.textSize} font-medium text-muted-foreground`}>Negative Prompt</p>
              <p className={`${config.textSize} ${config.fontWeight} text-foreground break-words whitespace-pre-wrap preserve-case`}>
                {showFullNegativePrompt || negativePrompt.length <= config.negativePromptLength ? negativePrompt : negativePrompt.slice(0, config.negativePromptLength) + '...'}
              </p>
              {negativePrompt.length > config.negativePromptLength && onShowFullNegativePromptChange && (
                <Button variant="ghost" size="sm" onClick={() => onShowFullNegativePromptChange(!showFullNegativePrompt)} className="h-6 px-0 text-xs text-primary">
                  {showFullNegativePrompt ? 'Show Less' : 'Show More'}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Technical Settings - only show in advanced mode */}
        {isAdvancedMode && (
          <div className="grid grid-cols-2 gap-3">
            {modelName && (
              <div className="space-y-1">
                <p className={`${config.textSize} font-medium text-muted-foreground`}>Model</p>
                <p className={`${config.textSize} ${config.fontWeight}`}>{formatModelName(modelName)}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className={`${config.textSize} font-medium text-muted-foreground`}>Resolution</p>
              <p className={`${config.textSize} ${config.fontWeight}`}>{resolution || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className={`${config.textSize} font-medium text-muted-foreground`}>{isSegmentTask ? 'Frames' : 'Frames / Segment'}</p>
              <p className={`${config.textSize} ${config.fontWeight}`}>{frames || 'N/A'}</p>
            </div>
            {phaseConfig?.flow_shift !== undefined && (
              <div className="space-y-1">
                <p className={`${config.textSize} font-medium text-muted-foreground`}>Flow Shift</p>
                <p className={`${config.textSize} ${config.fontWeight}`}>{phaseConfig.flow_shift}</p>
              </div>
            )}
            {phaseConfig?.sample_solver && (
              <div className="space-y-1">
                <p className={`${config.textSize} font-medium text-muted-foreground`}>Solver</p>
                <p className={`${config.textSize} ${config.fontWeight} capitalize`}>{phaseConfig.sample_solver}</p>
              </div>
            )}
          </div>
        )}

        {!showPhaseContentInRightColumn && isAdvancedMode && renderPhaseConfigSection({ showSummary: false })}

        {/* In basic mode OR no phases with loras: show "LoRAs" from additional_loras */}
        {!showPhaseContentInRightColumn && (!isAdvancedMode || !phaseConfig?.phases?.length) && additionalLoras && Object.keys(additionalLoras).length > 0 && (
          <div className="pt-2 border-t border-muted-foreground/20 space-y-2">
            <p className={`${config.textSize} font-medium text-muted-foreground`}>LoRAs</p>
            {Object.entries(additionalLoras).slice(0, config.maxLoras).map(([url, strength]) => (
              <div key={url} className={`group/lora flex items-center gap-2 p-1.5 bg-background/50 rounded border ${config.textSize} min-w-0`}>
                <span className={`${config.fontWeight} truncate min-w-0 flex-1`}>{getDisplayNameFromUrl(url, availableLoras)}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(url); setCopiedLoraUrl(url); setTimeout(() => setCopiedLoraUrl(null), 2000); }}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/lora:opacity-100 shrink-0"
                  title="Copy LoRA URL"
                >
                  {copiedLoraUrl === url ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </button>
                <span className="text-muted-foreground shrink-0">{Number(strength).toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPhaseContentInRightColumn && (
        <div className="space-y-4 lg:border-l lg:border-muted-foreground/20 lg:pl-4 min-w-0">
          {renderPhaseConfigSection({ showSummary: true, borderTop: 'pt-3' })}
        </div>
      )}
    </div>
  );
};
