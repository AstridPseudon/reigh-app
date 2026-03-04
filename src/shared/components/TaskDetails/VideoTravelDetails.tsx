import React, { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { TaskDetailsProps, getVariantConfig } from '@/shared/types/taskDetailsTypes';
import { getDisplayNameFromUrl } from '@/shared/lib/loraUtils';
import { getSupabaseClient } from '@/integrations/supabase/client';
import { presetQueryKeys } from '@/shared/lib/queryKeys/presets';
import type { PhaseLoraConfig, PhaseSettings } from '@/shared/types/phaseConfig';
import { asNumber, asString, asRecord } from '@/shared/lib/tasks/taskParamParsers';
import {
  formatTravelModelName,
  resolveTravelPresetName,
  useVideoTravelTaskData,
} from './hooks/useVideoTravelTaskData';
import { useCopyToClipboard } from './hooks/useCopyToClipboard';
import { TaskGuidanceImages } from './components/TaskGuidanceImages';
import { TaskPromptDetails } from './components/TaskPromptDetails';
import { TaskLoraDetails } from './components/TaskLoraDetails';

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

  const { copiedValue: copiedPromptValue, copyText: copyPromptText } = useCopyToClipboard<'prompt'>();
  const { copiedValue: copiedLoraUrl, copyText: copyLoraUrl } = useCopyToClipboard<string>();

  const handleCopyPrompt = useCallback((text: string) => {
    void copyPromptText(text, 'prompt');
  }, [copyPromptText]);

  const handleCopyLoraUrl = useCallback((url: string) => {
    void copyLoraUrl(url, url);
  }, [copyLoraUrl]);

  const {
    isSegmentTask,
    isAdvancedMode,
    showPhaseContentInRightColumn,
    effectiveInputImages,
    phaseConfig,
    phaseStepsDisplay,
    additionalLoras,
    prompt,
    enhancePrompt,
    negativePrompt,
    structureGuidance,
    videoPath,
    videoTreatment,
    motionStrength,
    styleImage,
    styleStrength,
    presetId,
    isDbPreset,
    modelName,
    resolution,
    frames,
  } = useVideoTravelTaskData({
    taskParams: task.params,
    inputImages,
    variant,
  });

  const { data: dbPresetName } = useQuery({
    queryKey: presetQueryKeys.name(presetId ?? ''),
    queryFn: async () => {
      if (!presetId) return null;
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('resources')
        .select('metadata')
        .eq('id', presetId)
        .single();
      return asString(asRecord(data?.metadata)?.name) || null;
    },
    enabled: !!isDbPreset && !!presetId,
    staleTime: Infinity,
  });

  const presetName = resolveTravelPresetName(presetId, dbPresetName);
  const phaseSettings = useMemo(() => {
    if (!Array.isArray(phaseConfig?.phases)) {
      return [];
    }
    return phaseConfig.phases as PhaseSettings[];
  }, [phaseConfig]);

  const phaseStepsPerPhase = useMemo(() => {
    if (!Array.isArray(phaseConfig?.steps_per_phase)) {
      return undefined;
    }
    const parsed = phaseConfig.steps_per_phase
      .map((value) => asNumber(value))
      .filter((value): value is number => value !== undefined);
    return parsed.length > 0 ? parsed : undefined;
  }, [phaseConfig]);

  const phaseCount = asNumber(phaseConfig?.num_phases) || phaseSettings.length;
  const phaseFlowShift = asNumber(phaseConfig?.flow_shift);
  const phaseSolver = asString(phaseConfig?.sample_solver);

  const renderPhasesList = () => (
    <>
      {phaseSettings.map((phase, phaseIndex) => (
        <div key={phase.phase} className="space-y-1">
          <p className={`${config.textSize} font-medium`}>Phase {phase.phase}</p>
          <div className="ml-2 space-y-1">
            <div className="flex gap-3">
              <span className={`${config.textSize} text-muted-foreground`}>
                Guidance:{' '}
                <span className={`${config.fontWeight} text-foreground`}>
                  {Number(phase.guidance_scale).toFixed(1)}
                </span>
              </span>
              {phaseStepsPerPhase?.[phaseIndex] !== undefined && (
                <span className={`${config.textSize} text-muted-foreground`}>
                  Steps:{' '}
                  <span className={`${config.fontWeight} text-foreground`}>
                    {phaseStepsPerPhase[phaseIndex]}
                  </span>
                </span>
              )}
            </div>
            {phase.loras?.length > 0 && phase.loras.map((lora: PhaseLoraConfig & { name?: string }, idx) => (
              <div
                key={idx}
                className={`group/lora flex items-center gap-2 p-1.5 bg-background/50 rounded border ${config.textSize} min-w-0`}
              >
                <span className={`${config.fontWeight} truncate min-w-0 flex-1`}>
                  {getDisplayNameFromUrl(lora.url, availableLoras, lora.name)}
                </span>
                <button
                  onClick={() => handleCopyLoraUrl(lora.url)}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/lora:opacity-100 shrink-0"
                  title="Copy LoRA URL"
                >
                  {copiedLoraUrl === lora.url
                    ? <Check className="w-3 h-3 text-green-500" />
                    : <Copy className="w-3 h-3" />}
                </button>
                <span className="text-muted-foreground shrink-0">
                  {Number(lora.multiplier).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );

  const renderPhaseConfigSection = (opts: { showSummary: boolean; borderTop?: string }) => {
    if (phaseSettings.length === 0) {
      return null;
    }

    return (
      <>
        {opts.showSummary && (
          <div className="space-y-2">
            <p className={`${config.textSize} font-medium text-muted-foreground`}>Phase Settings</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={`${config.textSize} text-muted-foreground`}>Phases:</span>{' '}
                <span className={`${config.textSize} ${config.fontWeight}`}>{phaseCount}</span>
              </div>
              {phaseFlowShift !== undefined && (
                <div>
                  <span className={`${config.textSize} text-muted-foreground`}>Flow Shift:</span>{' '}
                  <span className={`${config.textSize} ${config.fontWeight}`}>{phaseFlowShift}</span>
                </div>
              )}
              {phaseSolver && (
                <div>
                  <span className={`${config.textSize} text-muted-foreground`}>Solver:</span>{' '}
                  <span className={`${config.textSize} ${config.fontWeight} capitalize`}>{phaseSolver}</span>
                </div>
              )}
            </div>
            {phaseStepsDisplay && (
              <div>
                <span className={`${config.textSize} text-muted-foreground`}>Steps per Phase:</span>{' '}
                <span className={`${config.textSize} ${config.fontWeight}`}>{phaseStepsDisplay}</span>
              </div>
            )}
          </div>
        )}
        <div className={`${opts.borderTop ?? 'pt-2'} border-t border-muted-foreground/20 space-y-2`}>
          <p className={`${config.textSize} font-medium text-muted-foreground`}>Phases</p>
          {renderPhasesList()}
        </div>
      </>
    );
  };

  return (
    <div
      className={`p-3 bg-muted/30 rounded-lg border ${showPhaseContentInRightColumn ? 'w-full grid grid-cols-1 lg:grid-cols-2 gap-4' : ''} ${!showPhaseContentInRightColumn && variant === 'panel' ? '' : variant === 'modal' && isMobile ? 'w-full' : !showPhaseContentInRightColumn ? 'w-[360px]' : ''}`}
    >
      <div className={showPhaseContentInRightColumn ? 'space-y-4 min-w-0' : 'space-y-4'}>
        <TaskGuidanceImages
          config={config}
          effectiveInputImages={effectiveInputImages}
          showAllImages={showAllImages}
          onShowAllImagesChange={onShowAllImagesChange}
          videoPath={videoPath}
          videoLoaded={videoLoaded}
          onLoadVideo={() => setVideoLoaded(true)}
          structureGuidance={structureGuidance}
          videoTreatment={videoTreatment}
          motionStrength={motionStrength}
        />

        {styleImage && (
          <div className="space-y-1.5">
            <p className={`${config.textSize} font-medium text-muted-foreground`}>Style Reference</p>
            <div className="flex items-center gap-3">
              <img src={styleImage} alt="Style" className="w-[80px] object-cover rounded border" />
              {styleStrength != null && (
                <span className={`${config.textSize} ${config.fontWeight}`}>
                  Strength: {Math.round(styleStrength * 100)}%
                </span>
              )}
            </div>
          </div>
        )}

        {presetName && (
          <div className="space-y-1">
            <p className={`${config.textSize} font-medium text-muted-foreground`}>Motion Preset</p>
            <p className={`${config.textSize} ${config.fontWeight}`}>{presetName}</p>
          </div>
        )}

        <TaskPromptDetails
          config={config}
          prompt={prompt}
          enhancePrompt={enhancePrompt}
          negativePrompt={negativePrompt}
          showFullPrompt={showFullPrompt}
          onShowFullPromptChange={onShowFullPromptChange}
          showFullNegativePrompt={showFullNegativePrompt}
          onShowFullNegativePromptChange={onShowFullNegativePromptChange}
          showCopyButtons={showCopyButtons}
          copiedPrompt={copiedPromptValue === 'prompt'}
          onCopyPrompt={handleCopyPrompt}
        />

        {isAdvancedMode && (
          <div className="grid grid-cols-2 gap-3">
            {modelName && (
              <div className="space-y-1">
                <p className={`${config.textSize} font-medium text-muted-foreground`}>Model</p>
                <p className={`${config.textSize} ${config.fontWeight}`}>{formatTravelModelName(modelName)}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className={`${config.textSize} font-medium text-muted-foreground`}>Resolution</p>
              <p className={`${config.textSize} ${config.fontWeight}`}>{resolution || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className={`${config.textSize} font-medium text-muted-foreground`}>
                {isSegmentTask ? 'Frames' : 'Frames / Segment'}
              </p>
              <p className={`${config.textSize} ${config.fontWeight}`}>{frames || 'N/A'}</p>
            </div>
            {phaseFlowShift !== undefined && (
              <div className="space-y-1">
                <p className={`${config.textSize} font-medium text-muted-foreground`}>Flow Shift</p>
                <p className={`${config.textSize} ${config.fontWeight}`}>{phaseFlowShift}</p>
              </div>
            )}
            {phaseSolver && (
              <div className="space-y-1">
                <p className={`${config.textSize} font-medium text-muted-foreground`}>Solver</p>
                <p className={`${config.textSize} ${config.fontWeight} capitalize`}>{phaseSolver}</p>
              </div>
            )}
          </div>
        )}

        {!showPhaseContentInRightColumn && isAdvancedMode && renderPhaseConfigSection({ showSummary: false })}

        {!showPhaseContentInRightColumn && (!isAdvancedMode || phaseSettings.length === 0) && (
          <TaskLoraDetails
            config={config}
            additionalLoras={additionalLoras}
            availableLoras={availableLoras}
            copiedLoraUrl={copiedLoraUrl}
            onCopyLoraUrl={handleCopyLoraUrl}
          />
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
