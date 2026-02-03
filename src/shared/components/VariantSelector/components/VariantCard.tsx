/**
 * VariantCard Component
 *
 * Renders an individual variant thumbnail with:
 * - Clickable thumbnail with status rings (active, primary, parent, child)
 * - NEW badge or time-ago indicator
 * - Desktop: HoverCard with full details, actions (Make Primary, Load Settings, Delete, Copy ID, Lineage GIF)
 * - Mobile: plain button (info shown via MobileInfoModal on re-tap)
 */

import React from 'react';
import { Check, Loader2, ArrowDown, ArrowUp, Download, Trash2, GitBranch, Star } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/shared/components/ui/hover-card';
import { GenerationDetails } from '@/shared/components/GenerationDetails';
import type { LoraModel } from '@/shared/components/LoraSelectorModal';
import { getSourceTaskId } from '@/shared/lib/taskIdHelpers';
import { useGetTask } from '@/shared/hooks/useTasks';
import type { GenerationVariant } from '@/shared/hooks/useVariants';
import { getVariantIcon, getVariantLabel, isNewVariant, getTimeAgo, hasLoadableSettings } from '../utils';

// --- VariantHoverDetails (fetches real task data for hover tooltip) ---

interface VariantHoverDetailsProps {
  variant: GenerationVariant;
  availableLoras?: LoraModel[];
}

const VariantHoverDetails: React.FC<VariantHoverDetailsProps> = ({ variant, availableLoras }) => {
  const variantParams = variant.params;
  const sourceTaskId = getSourceTaskId(variantParams);
  const { data: task, isLoading } = useGetTask(sourceTaskId || '');

  if (task && !isLoading) {
    return (
      <GenerationDetails
        task={task}
        inputImages={[]}
        variant="hover"
        isMobile={false}
        availableLoras={availableLoras}
        showCopyButtons={true}
      />
    );
  }

  return (
    <GenerationDetails
      task={{
        taskType: variantParams?.task_type || variantParams?.created_from || 'video_generation',
        params: variantParams,
      }}
      inputImages={[]}
      variant="hover"
      isMobile={false}
      availableLoras={availableLoras}
      showCopyButtons={true}
    />
  );
};

// --- VariantCard ---

export interface VariantCardProps {
  variant: GenerationVariant;
  isActive: boolean;
  isPrimary: boolean;
  isParent: boolean;
  isChild: boolean;
  activeVariantId: string | null;
  isMobile: boolean;
  readOnly: boolean;
  /** All variants in the list (for finding parent variant by source_variant_id) */
  variants: GenerationVariant[];
  availableLoras?: LoraModel[];
  /** Lineage depth for this variant (show GIF button when >= 5) */
  lineageDepth: number;
  /** Whether a delete operation is loading for this variant */
  isDeleteLoading: boolean;
  /** Currently copied variant ID (for copy-id feedback) */
  copiedVariantId: string | null;
  /** Loaded settings variant ID (for load-settings feedback) */
  loadedSettingsVariantId: string | null;
  // Callbacks
  onVariantSelect: (variantId: string) => void;
  onMakePrimary?: (variantId: string) => Promise<void>;
  onDeleteVariant?: (variantId: string) => void;
  onLoadVariantSettings?: (variantParams: Record<string, unknown>) => void;
  onMouseEnter: (variant: GenerationVariant) => void;
  onShowMobileInfo: (variantId: string) => void;
  onShowLineageGif: (variantId: string) => void;
  onCopyId: (variantId: string) => void;
  onLoadSettings: (variant: GenerationVariant) => void;
}

export const VariantCard: React.FC<VariantCardProps> = ({
  variant,
  isActive,
  isPrimary,
  isParent,
  isChild,
  activeVariantId,
  isMobile,
  readOnly,
  availableLoras,
  lineageDepth,
  isDeleteLoading,
  copiedVariantId,
  loadedSettingsVariantId,
  onVariantSelect,
  onMakePrimary,
  onDeleteVariant,
  onLoadVariantSettings,
  onMouseEnter,
  onShowMobileInfo,
  onShowLineageGif,
  onCopyId,
  onLoadSettings,
}) => {
  const Icon = getVariantIcon(variant.variant_type);
  const label = getVariantLabel(variant);

  const buttonContent = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (isMobile && isActive) {
          onShowMobileInfo(variant.id);
          return;
        }
        onVariantSelect(variant.id);
      }}
      onTouchEnd={(e) => {
        if (isMobile) {
          e.stopPropagation();
          if (isActive) {
            onShowMobileInfo(variant.id);
            return;
          }
          onVariantSelect(variant.id);
        }
      }}
      onMouseEnter={() => onMouseEnter(variant)}
      className={cn(
        'relative block p-0.5 rounded transition-all w-full touch-manipulation',
        'hover:bg-muted/80',
        isPrimary && !isActive && 'ring-2 ring-green-500 bg-green-500/10',
        isActive
          ? 'ring-2 ring-orange-500 bg-orange-500/10'
          : 'opacity-70 hover:opacity-100',
        isParent && !isActive && !isPrimary && 'ring-1 ring-blue-500/50',
        isChild && !isActive && !isPrimary && 'ring-1 ring-purple-500/50'
      )}
    >
      {/* Thumbnail */}
      <div className="relative w-full rounded overflow-hidden bg-muted" style={{ paddingBottom: '56.25%' }}>
        {(variant.thumbnail_url || variant.location) ? (
          <img
            src={variant.thumbnail_url || variant.location}
            alt={label}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}

        {/* Primary badge */}
        {isPrimary && (
          <div className="absolute top-0.5 right-0.5 bg-green-500 rounded-full p-0.5 pointer-events-none">
            <Check className="w-2 h-2 text-white" />
          </div>
        )}

        {/* Parent relationship badge */}
        {isParent && !isActive && (
          <div className="absolute top-0.5 left-0.5 bg-blue-500 rounded-full p-0.5 pointer-events-none" title="Current is based on this">
            <ArrowUp className="w-2 h-2 text-white" />
          </div>
        )}

        {/* Child relationship badge */}
        {isChild && !isActive && (
          <div className="absolute top-0.5 left-0.5 bg-purple-500 rounded-full p-0.5 pointer-events-none" title="Based on current">
            <ArrowDown className="w-2 h-2 text-white" />
          </div>
        )}

        {/* NEW badge or time ago */}
        {isNewVariant(variant, activeVariantId) ? (
          <div className="absolute bottom-0.5 left-0.5 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded pointer-events-none">
            NEW
          </div>
        ) : (
          <div className="absolute bottom-0.5 left-0.5 bg-black/70 text-white text-[8px] px-1 rounded pointer-events-none">
            {getTimeAgo(variant.created_at)}
          </div>
        )}
      </div>
    </button>
  );

  // On mobile, render without HoverCard
  if (isMobile) {
    return <React.Fragment key={variant.id}>{buttonContent}</React.Fragment>;
  }

  // On desktop, use HoverCard for rich interactive content
  return (
    <HoverCard key={variant.id} openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {buttonContent}
      </HoverCardTrigger>
      <HoverCardContent side="top" usePortal className="z-[100001] max-w-md p-0 w-auto">
        <div className="p-2 space-y-2">
          {/* Header with label, status badges, id copy, delete button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{label}</p>
              {isPrimary && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                  Primary
                </span>
              )}
              {isActive && !isPrimary && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Viewing
                </span>
              )}
              {isParent && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Parent of current
                </span>
              )}
              {isChild && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  Child of current
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {/* Copy ID button */}
              {variant.variant_type !== 'trimmed' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyId(variant.id);
                      }}
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] transition-all duration-150",
                        copiedVariantId === variant.id
                          ? "text-green-400 bg-green-400/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95"
                      )}
                    >
                      {copiedVariantId === variant.id ? 'copied' : 'id'}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Copy ID
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Lineage GIF button */}
              {lineageDepth >= 5 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowLineageGif(variant.id);
                      }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-150 active:scale-95 animate-in fade-in slide-in-from-left-1 duration-300"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    View evolution ({lineageDepth} generations)
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Delete button */}
              {!readOnly && onDeleteVariant && !isPrimary && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteVariant(variant.id);
                      }}
                      disabled={isDeleteLoading}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 active:scale-95 disabled:opacity-50"
                    >
                      {isDeleteLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Delete
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* Full task details */}
          {variant.params && variant.variant_type !== 'trimmed' && (
            <div className="border-t border-border/50 pt-2">
              <VariantHoverDetails
                variant={variant}
                availableLoras={availableLoras}
              />
            </div>
          )}

          {/* Action buttons row */}
          {!readOnly && ((!isPrimary && onMakePrimary) || (onLoadVariantSettings && hasLoadableSettings(variant))) && (
            <div className="flex gap-1.5">
              {!isPrimary && onMakePrimary && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVariantSelect(variant.id);
                    setTimeout(() => onMakePrimary(variant.id), 50);
                  }}
                  className={cn(
                    "h-6 text-xs gap-1",
                    onLoadVariantSettings && hasLoadableSettings(variant) ? "flex-1" : "w-full"
                  )}
                >
                  <Star className="w-3 h-3" />
                  Make Primary
                </Button>
              )}
              {onLoadVariantSettings && hasLoadableSettings(variant) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadSettings(variant);
                  }}
                  className={cn(
                    "h-6 text-xs gap-1",
                    !isPrimary && onMakePrimary ? "flex-1" : "w-full",
                    loadedSettingsVariantId === variant.id && "bg-green-500/20 border-green-500/50 text-green-400"
                  )}
                >
                  {loadedSettingsVariantId === variant.id ? (
                    <>
                      <Check className="w-3 h-3" />
                      Loaded!
                    </>
                  ) : (
                    <>
                      <Download className="w-3 h-3" />
                      Load Settings
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default VariantCard;
