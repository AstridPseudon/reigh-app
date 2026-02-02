/**
 * LoraHeaderActions - Save/Load buttons for LoRA settings
 *
 * Extracted from useLoraSync to fix anti-pattern (hooks returning JSX).
 * Provides Save/Load functionality for project-level LoRA presets.
 */

import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import { Button } from '@/shared/components/ui/button';

interface LoraHeaderActionsProps {
  hasSavedLoras: boolean;
  onSave: () => Promise<void>;
  onLoad: () => Promise<void>;
  selectedLorasCount: number;
  isSaving: boolean;
  saveSuccess: boolean;
  saveFlash: boolean;
  savedLoras?: { id: string; strength: number }[];
}

export const LoraHeaderActions: React.FC<LoraHeaderActionsProps> = ({
  hasSavedLoras,
  onSave,
  onLoad,
  selectedLorasCount,
  isSaving,
  saveSuccess,
  saveFlash,
  savedLoras,
}) => {
  // Format saved LoRAs for tooltip
  const savedLorasContent = savedLoras && savedLoras.length > 0
    ? `Saved LoRAs (${savedLoras.length}):\n` +
      savedLoras.map(lora => `• ${lora.id} (strength: ${lora.strength})`).join('\n')
    : 'No saved LoRAs available';

  return (
    <div className="flex gap-1 ml-2 w-1/2">
      {/* Save LoRAs button with tooltip - 1/4 width */}
      <div className="flex-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSave}
              disabled={selectedLorasCount === 0 || isSaving}
              className={`w-full text-xs h-7 flex items-center justify-center transition-all duration-300 ${
                saveFlash
                  ? 'bg-green-400 hover:bg-green-500 border-green-400 text-white scale-105'
                  : saveSuccess
                  ? 'bg-green-600 hover:bg-green-700 border-green-600 text-white'
                  : ''
              }`}
            >
              <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Save current LoRAs to project</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Load LoRAs button with tooltip - 3/4 width */}
      <div className="flex-[3]">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLoad}
              disabled={!hasSavedLoras}
              className={`w-full text-xs h-7 ${
                hasSavedLoras
                  ? ''
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              Load LoRAs
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div style={{ whiteSpace: 'pre-line' }}>
              {savedLorasContent}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
