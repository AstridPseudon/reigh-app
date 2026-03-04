import React from 'react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/primitives/label';
import { RulesInput } from './RulesInput';
import { TemperatureSelector } from './TemperatureSelector';

interface AdvancedOptionsPanelProps {
  isDesktop: boolean;
  remixMode: boolean;
  rulesToRememberText: string;
  onRulesToRememberTextChange: (value: string) => void;
  temperature: number;
  onTemperatureChange: (value: number | readonly number[]) => void;
  includeExistingContext: boolean;
  onIncludeExistingContextChange: (value: boolean) => void;
  replaceCurrentPrompts: boolean;
  onReplaceCurrentPromptsChange: (value: boolean) => void;
  hasApiKey?: boolean;
  isGenerating: boolean;
  existingPromptsCount: number;
}

export const AdvancedOptionsPanel: React.FC<AdvancedOptionsPanelProps> = ({
  isDesktop,
  remixMode,
  rulesToRememberText,
  onRulesToRememberTextChange,
  temperature,
  onTemperatureChange,
  includeExistingContext,
  onIncludeExistingContextChange,
  replaceCurrentPrompts,
  onReplaceCurrentPromptsChange,
  hasApiKey,
  isGenerating,
  existingPromptsCount,
}) => {
  return (
    <div className={isDesktop ? 'hidden lg:block w-80 space-y-4 bg-accent/30 border border-accent-foreground/10 rounded-lg p-4' : 'w-full lg:w-80 space-y-4 bg-accent/30 border border-accent-foreground/10 rounded-lg p-4 lg:hidden'}>
      <RulesInput
        value={rulesToRememberText}
        onChange={onRulesToRememberTextChange}
        disabled={!hasApiKey || isGenerating}
        isDesktop={isDesktop}
      />

      <div className={isDesktop && !remixMode ? 'flex gap-4' : ''}>
        <div className={isDesktop && !remixMode ? 'flex-1' : ''}>
          <TemperatureSelector
            temperature={temperature}
            onChange={onTemperatureChange}
            disabled={!hasApiKey || isGenerating}
          />
        </div>

        {!remixMode && (
          <div className={isDesktop ? 'flex-1 flex flex-col gap-3 justify-center' : 'flex flex-col sm:flex-row gap-4 sm:gap-6 mt-4'}>
            <div className="flex items-center gap-x-2">
              <Checkbox
                id={`gen_includeExistingContext_${isDesktop ? 'desktop' : 'mobile'}`}
                checked={includeExistingContext}
                onCheckedChange={(checked) => onIncludeExistingContextChange(Boolean(checked))}
                disabled={!hasApiKey || isGenerating || existingPromptsCount === 0}
              />
              <Label htmlFor={`gen_includeExistingContext_${isDesktop ? 'desktop' : 'mobile'}`} className={isDesktop ? 'font-normal text-sm' : 'font-normal'}>
                Include current prompts
              </Label>
            </div>
            <div className="flex items-center gap-x-2">
              <Checkbox
                id={`gen_replaceCurrentPrompts_${isDesktop ? 'desktop' : 'mobile'}`}
                checked={replaceCurrentPrompts}
                onCheckedChange={(checked) => onReplaceCurrentPromptsChange(Boolean(checked))}
                disabled={!hasApiKey || isGenerating}
              />
              <Label htmlFor={`gen_replaceCurrentPrompts_${isDesktop ? 'desktop' : 'mobile'}`} className={isDesktop ? 'font-normal text-sm' : 'font-normal'}>
                Replace current prompts
              </Label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
