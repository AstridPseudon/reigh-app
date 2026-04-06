import React from 'react';
import type { GenerationRow } from '@/domains/generation/types';
import { getDisplayUrl } from '@/shared/lib/media/mediaUrl';
import { ExternalLinkTooltipButton } from '@/shared/components/ui/composed/ExternalLinkTooltipButton';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { BatchSettingsForm } from '@/tools/travel-between-images/components/BatchSettingsForm';
import { MotionControl } from '@/tools/travel-between-images/components/MotionControl';
import { ShotImagesEditor } from '@/tools/travel-between-images/components/ShotImagesEditor';
import { PanelSectionHeader } from '@/tools/travel-between-images/components/shared/PanelSectionHeader';
import { CollapsibleSection } from '@/shared/components/ui/composed/collapsible-section';
import {
  DEFAULT_PHASE_CONFIG,
  coerceSelectedModel,
  getModelSpec,
  type VideoTravelSettings,
} from '@/tools/travel-between-images/settings';
import type { ActiveLora, LoraModel } from '@/domains/lora/types/lora';
import type { TravelGuidanceMode } from '@/shared/lib/tasks/travelGuidance';
import type { Project } from '@/types/project';

type PositionedImagePreview = Pick<GenerationRow, 'id' | 'thumbUrl' | 'imageUrl' | 'location'>;

function getImageSrc(image: PositionedImagePreview): string | undefined {
  return getDisplayUrl(image.thumbUrl || image.imageUrl || image.location);
}

function truncatePrompt(prompt: string, limit = 60): string {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return 'No prompt';
  }
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit - 1)}...`;
}

function formatModelLabel(settings: VideoTravelSettings): string {
  const spec = getModelSpec(coerceSelectedModel(settings.selectedModel));
  switch (spec.id) {
    case 'wan-2.2':
      return 'Wan 2.2';
    case 'ltx-2.3':
      return 'LTX 2.3';
    case 'ltx-2.3-fast':
      return 'LTX 2.3 Fast';
    default:
      return spec.id;
  }
}

interface VideoGenerationModalHeaderProps {
  shotName: string | undefined;
  positionedImages: PositionedImagePreview[];
  onNavigateToShot: () => void;
}

export function VideoGenerationModalHeader({
  shotName,
  positionedImages,
  onNavigateToShot,
}: VideoGenerationModalHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xl font-light">
          Generate Video - <span className="preserve-case">{shotName || 'Unnamed Shot'}</span>
        </span>
        <ExternalLinkTooltipButton
          onClick={onNavigateToShot}
          tooltipLabel="Open Shot Editor"
        />
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {positionedImages.slice(0, 6).map((img, idx) => (
          <img
            key={img.id || idx}
            src={getDisplayUrl(img.thumbUrl || img.imageUrl || img.location)}
            alt={`Image ${idx + 1}`}
            className="w-7 h-7 object-cover rounded border border-zinc-600"
          />
        ))}
        {positionedImages.length > 6 && (
          <div className="w-7 h-7 rounded border border-zinc-600 bg-zinc-700 flex items-center justify-center text-[10px] text-zinc-400">
            +{positionedImages.length - 6}
          </div>
        )}
        {positionedImages.length < 1 && <span className="text-xs text-amber-500">(need 1+ images)</span>}
      </div>
    </div>
  );
}

export function VideoGenerationModalLoadingContent(): React.ReactElement {
  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/2">
          <div className="mb-4">
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-[70px] w-full rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-[70px] w-full rounded-md" />
              </div>
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-full rounded-full" />
            </div>
          </div>
        </div>

        <div className="lg:w-1/2">
          <div className="mb-4">
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReadOnlyShotImagesGridProps {
  shotId: string;
  images: GenerationRow[];
  aspectRatio: string;
  batchVideoFrames: number;
}

export function ReadOnlyShotImagesGrid({
  shotId,
  images,
  aspectRatio,
  batchVideoFrames,
}: ReadOnlyShotImagesGridProps): React.ReactElement {
  return (
    <ShotImagesEditor
      displayOptions={{
        isModeReady: true,
        isMobile: false,
        generationMode: 'batch',
        onGenerationModeChange: () => {},
        columns: 4,
        skeleton: null,
        readOnly: true,
        projectAspectRatio: aspectRatio,
      }}
      imageState={{
        selectedShotId: shotId,
        preloadedImages: images,
        batchVideoFrames,
        pendingPositions: new Map(),
        unpositionedGenerationsCount: 0,
        fileInputKey: 0,
        isUploadingImage: false,
      }}
      editActions={{
        onImageReorder: () => {},
        onFramePositionsChange: () => {},
        onFileDrop: async () => {},
        onPendingPositionApplied: () => {},
        onImageDelete: () => {},
        onOpenUnpositionedPane: () => {},
        onImageUpload: async () => {},
      }}
      shotWorkflow={{}}
    />
  );
}

interface ShotImagesSummaryProps {
  images: GenerationRow[];
}

export function ShotImagesSummary({ images }: ShotImagesSummaryProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-muted-foreground/30 bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-1 overflow-hidden">
        {images.slice(0, 6).map((image, index) => {
          const src = getImageSrc(image);
          if (!src) {
            return null;
          }

          return (
            <img
              key={image.id || index}
              src={src}
              alt={`Shot image ${index + 1}`}
              className="h-8 w-8 flex-shrink-0 rounded border border-zinc-600 object-cover"
            />
          );
        })}
        {images.length > 6 && (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-zinc-600 bg-zinc-700 text-[10px] text-zinc-400">
            +{images.length - 6}
          </div>
        )}
        {images.length < 1 && <span className="text-xs text-amber-500">No shot images</span>}
      </div>

      <div className="flex-shrink-0 rounded-full border border-muted-foreground/30 px-2 py-1 text-xs text-muted-foreground">
        {images.length} image{images.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}

interface GenerationSettingsSummaryProps {
  settings: VideoTravelSettings;
}

export function GenerationSettingsSummary({
  settings,
}: GenerationSettingsSummaryProps): React.ReactElement {
  return (
    <div className="rounded-lg border border-muted-foreground/30 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{formatModelLabel(settings)}</span>
      {' · '}
      <span>{settings.batchVideoFrames || 61}f</span>
      {' · '}
      <span>{truncatePrompt(settings.prompt || '')}</span>
    </div>
  );
}

interface VideoGenerationModalFormContentProps {
  settings: VideoTravelSettings;
  updateField: <K extends keyof VideoTravelSettings>(key: K, value: VideoTravelSettings[K]) => void;
  projects: Project[];
  selectedProjectId: string | null;
  selectedLoras: ActiveLora[];
  availableLoras: LoraModel[] | undefined;
  accelerated: boolean;
  onAcceleratedChange: (value: boolean) => void;
  randomSeed: boolean;
  onRandomSeedChange: (value: boolean) => void;
  imageCount: number;
  hasStructureVideo: boolean;
  guidanceKind?: TravelGuidanceMode;
  validPresetId: string | undefined;
  status: 'idle' | 'loading' | 'ready' | 'saving' | 'error';
  onOpenLoraModal: () => void;
  onRemoveLora: (loraId: string) => void;
  onLoraStrengthChange: (loraId: string, strength: number) => void;
  onAddTriggerWord: (word: string) => void;
}

interface ControlledAccordionSectionProps {
  title: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  summary: React.ReactNode;
  children: React.ReactNode;
}

function ControlledAccordionSection({
  title,
  isOpen,
  onOpenChange,
  summary,
  children,
}: ControlledAccordionSectionProps): React.ReactElement {
  return (
    <div className="space-y-2">
      <CollapsibleSection title={title} open={isOpen} onOpenChange={onOpenChange}>
        {children}
      </CollapsibleSection>
      {!isOpen && summary}
    </div>
  );
}

interface VideoGenerationModalAccordionContentProps extends VideoGenerationModalFormContentProps {
  defaultTopOpen: boolean;
  defaultBottomOpen: boolean;
  shotId: string;
  images: GenerationRow[];
  aspectRatio: string;
  batchVideoFrames: number;
}

export function VideoGenerationModalAccordionContent({
  defaultTopOpen,
  defaultBottomOpen,
  shotId,
  images,
  aspectRatio,
  batchVideoFrames,
  ...formProps
}: VideoGenerationModalAccordionContentProps): React.ReactElement {
  const [isTopOpen, setIsTopOpen] = React.useState(defaultTopOpen);
  const [isBottomOpen, setIsBottomOpen] = React.useState(defaultBottomOpen);

  return (
    <div className="space-y-4 pb-4">
      <ControlledAccordionSection
        title="Shot Images"
        isOpen={isTopOpen}
        onOpenChange={setIsTopOpen}
        summary={<ShotImagesSummary images={images} />}
      >
        <ReadOnlyShotImagesGrid
          shotId={shotId}
          images={images}
          aspectRatio={aspectRatio}
          batchVideoFrames={batchVideoFrames}
        />
      </ControlledAccordionSection>

      <ControlledAccordionSection
        title="Generation Settings"
        isOpen={isBottomOpen}
        onOpenChange={setIsBottomOpen}
        summary={<GenerationSettingsSummary settings={formProps.settings} />}
      >
        <VideoGenerationModalFormContent {...formProps} />
      </ControlledAccordionSection>
    </div>
  );
}

export function VideoGenerationModalFormContent({
  settings,
  updateField,
  projects,
  selectedProjectId,
  selectedLoras,
  availableLoras,
  accelerated,
  onAcceleratedChange,
  randomSeed,
  onRandomSeedChange,
  imageCount,
  hasStructureVideo,
  guidanceKind,
  validPresetId,
  status,
  onOpenLoraModal,
  onRemoveLora,
  onLoraStrengthChange,
  onAddTriggerWord,
}: VideoGenerationModalFormContentProps): React.ReactElement {
  const selectedModel = coerceSelectedModel(settings.selectedModel);

  return (
    <div className="space-y-6 pb-4">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/2">
          <PanelSectionHeader title="Settings" theme="orange" />
          <BatchSettingsForm
            selectedModel={selectedModel}
            batchVideoPrompt={settings.prompt || ''}
            onBatchVideoPromptChange={(v) => updateField('prompt', v)}
            batchVideoFrames={settings.batchVideoFrames || 61}
            onBatchVideoFramesChange={(v) => updateField('batchVideoFrames', v)}
            batchVideoSteps={settings.batchVideoSteps || 6}
            onBatchVideoStepsChange={(v) => updateField('batchVideoSteps', v)}
            dimensionSource={settings.dimensionSource || 'firstImage'}
            onDimensionSourceChange={(v) => updateField('dimensionSource', v)}
            customWidth={settings.customWidth}
            onCustomWidthChange={(v) => updateField('customWidth', v)}
            customHeight={settings.customHeight}
            onCustomHeightChange={(v) => updateField('customHeight', v)}
            negativePrompt={settings.negativePrompt || ''}
            onNegativePromptChange={(v) => updateField('negativePrompt', v)}
            projects={projects}
            selectedProjectId={selectedProjectId}
            selectedLoras={selectedLoras}
            availableLoras={availableLoras}
            isTimelineMode={false}
            accelerated={accelerated}
            onAcceleratedChange={onAcceleratedChange}
            randomSeed={randomSeed}
            onRandomSeedChange={onRandomSeedChange}
            turboMode={settings.turboMode || false}
            onTurboModeChange={(v) => updateField('turboMode', v)}
            smoothContinuations={settings.smoothContinuations || false}
            amountOfMotion={settings.amountOfMotion || 50}
            onAmountOfMotionChange={(v) => updateField('amountOfMotion', v)}
            imageCount={imageCount}
            enhancePrompt={settings.enhancePrompt}
            onEnhancePromptChange={(v) => updateField('enhancePrompt', v)}
            advancedMode={(settings.motionMode || 'basic') === 'advanced'}
            generationTypeMode={settings.generationTypeMode || 'i2v'}
            phaseConfig={settings.phaseConfig || DEFAULT_PHASE_CONFIG}
            onPhaseConfigChange={(v) => updateField('phaseConfig', v)}
            selectedPhasePresetId={validPresetId}
            onPhasePresetSelect={(id, config) => {
              updateField('selectedPhasePresetId', id);
              updateField('phaseConfig', config);
            }}
            onPhasePresetRemove={() => updateField('selectedPhasePresetId', undefined)}
            videoControlMode="batch"
            textBeforePrompts={settings.textBeforePrompts || ''}
            onTextBeforePromptsChange={(v) => updateField('textBeforePrompts', v)}
            textAfterPrompts={settings.textAfterPrompts || ''}
            onTextAfterPromptsChange={(v) => updateField('textAfterPrompts', v)}
          />
        </div>

        <div className="lg:w-1/2">
          <PanelSectionHeader title="Motion" theme="purple" />
          <MotionControl
            mode={{
              motionMode: (settings.motionMode || 'basic') as 'basic' | 'advanced',
              onMotionModeChange: (v) => {
                updateField('motionMode', v);
                updateField('advancedMode', v === 'advanced');
              },
              selectedModel,
              generationTypeMode: settings.generationTypeMode || 'i2v',
              onGenerationTypeModeChange: (v) => updateField('generationTypeMode', v),
              hasStructureVideo,
              guidanceKind,
            }}
            lora={{
              selectedLoras,
              availableLoras: availableLoras || [],
              onAddLoraClick: onOpenLoraModal,
              onRemoveLora,
              onLoraStrengthChange,
              onAddTriggerWord: (word) => onAddTriggerWord(word),
            }}
            presets={{
              selectedPhasePresetId: validPresetId,
              onPhasePresetSelect: (id, config) => {
                updateField('selectedPhasePresetId', id);
                updateField('phaseConfig', config);
              },
              onPhasePresetRemove: () => updateField('selectedPhasePresetId', undefined),
              currentSettings: {},
            }}
            advanced={{
              phaseConfig: settings.phaseConfig || DEFAULT_PHASE_CONFIG,
              onPhaseConfigChange: (v) => updateField('phaseConfig', v),
              randomSeed,
              onRandomSeedChange,
            }}
            stateOverrides={{
              turboMode: settings.turboMode || false,
              settingsLoading: status !== 'ready' && status !== 'saving',
            }}
          />
        </div>
      </div>
    </div>
  );
}
